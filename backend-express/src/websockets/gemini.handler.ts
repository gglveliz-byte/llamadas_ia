import { Type } from "@google/genai";
import { WebSocket as WS } from "ws";
import { db } from "../models/database.pool";
import { obtenerContextoRAG } from "../services/rag.service";
import { agendarCita, cancelarCita, consultarDisponibilidad, reagendarCita } from "../services/calendar.service";
import { transcodificarGeminiATelefonía } from "../utils/audioTranscoder";
import { emitirSSE } from "../sse/events.emitter";
import { registrarLatencia, enviarAlertaAdmin } from "../services/monitoring.service";
import { actualizarRateLimitGemini } from "../services/ratelimit.service";
import { vadConfigManager } from "../services/vad.service";
import { conTimeout, crearDedup, firmaHerramienta } from "../utils/toolGuards";
import { normalizarVoz } from "../utils/voices";
import { obtenerRegion, derivarIdiomaDeRegion, HUMANIZACION_BASE } from "../utils/region";
import { logger } from "../utils/logger";
import { agregarChunkOutbound } from "../services/audio.service";
import { hangupCall } from "../services/telnyx.service";
import { cerrarLlamadaWebSocket, obtenerTiempoRestanteAudio } from "./telnyxStream.handler";

// Timeouts de ejecución por herramienta (la voz espera: mantener cortos)
const TIMEOUTS: Record<string, number> = {
  consultar_disponibilidad: 2000,
  agendar_cita: 5000,
  reagendar_cita: 6000,
  cancelar_cita: 2500,
};
const TIMEOUT_DEFAULT = 2500;
const UMBRAL_TOOL_LENTA_MS = 2000;

// Herramientas mutantes: deduplicadas por llamada para evitar doble ejecución
const HERRAMIENTAS_MUTANTES = new Set(["agendar_cita", "cancelar_cita"]);
const dedupHerramientas = crearDedup(90000);

// URL base de la API de Gemini para detectar requests a interceptar
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";

// Wrapper de fetch global para interceptar requests a Gemini API
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes("generativelanguage.googleapis.com")) {
    const response = await originalFetch(input, init);
    // Capturar rate limit headers de la respuesta
    const headers: Record<string, string | undefined> = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith("x-ratelimit")) {
        headers[key] = value;
      }
    });
    if (Object.keys(headers).length > 0) {
      actualizarRateLimitGemini(headers).catch((e) =>
        console.error("Error actualizando rate limit Gemini:", e)
      );
    }
    return response;
  }
  return originalFetch(input, init);
};

const MODELO = process.env.GEMINI_MODEL || "models/gemini-3.1-flash-live-preview";

export type SesionGemini = WS;

/**
 * Crea una sesión de Gemini Live para una llamada entrante.
 * Cumple spec 7.3.
 */
export async function crearSesionGemini(
  userId: string,
  callSid: string,
  streamSid: string,
  modo: "inbound" | "outbound" = "inbound"
): Promise<SesionGemini | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn({ callSid }, "GEMINI_API_KEY no configurada - sesión simulada");
    return null;
  }

  // Obtener contexto del negocio + settings en paralelo con la apertura del WS
  // para ocultar el costo del embedding/RAG detrás del handshake.
  const promesaSettings = db.businessSettings.findUnique({ where: { userId } });
  const [settings, contexto, vadCfg] = await Promise.all([
    promesaSettings,
    promesaSettings.then((s) =>
      obtenerContextoRAG(userId, s?.systemPromptContext || "información del negocio")
    ),
    vadConfigManager.getConfig(),
  ]);
  if (!settings) {
    logger.error({ userId }, "Settings no encontradas al crear sesión Gemini");
    return null;
  }

  const systemPrompt = construirSystemPrompt(contexto, settings, callSid, modo);
  const herramientas = obtenerHerramientas(settings);
  const aiVoice = normalizarVoz(settings.aiVoice);
  const region = obtenerRegion(settings.aiRegion);
  const prefixPadMs = Number(vadCfg.gemini_prefix_pad_ms) || 250;
  const silenceMs = Number(vadCfg.gemini_silence_ms) || 600;

  try {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const geminiWs = new WS(wsUrl);

    // We will initialize the setup message when the socket opens (handled in telnyxStream usually, but let's do it here)
    geminiWs.on("open", () => {
      logger.info({ callSid, streamSid, userId }, "[GEMINI API] 🔌 Conexión WebSocket ABIERTA. Enviando mensaje de configuración (setup)...");
      const setupMsg = {
        setup: {
          model: MODELO,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              languageCode: region.languageCode,
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: aiVoice
                }
              }
            }
          },
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [{ functionDeclarations: herramientas[0].functionDeclarations }],
          realtimeInputConfig: {
            automaticActivityDetection: {
              prefixPaddingMs: prefixPadMs,
              silenceDurationMs: silenceMs,
            },
            activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
          }
        }
      };
      geminiWs.send(JSON.stringify(setupMsg));
    });
    
    geminiWs.on("error", (e) => {
      logger.error({ error: e.message, callSid }, "Error en WebSocket de Gemini Live");
    });

    return geminiWs;
  } catch (e) {
    logger.error({ error: (e as Error).message, callSid }, "Error conectando con Gemini Live API");
    enviarAlertaAdmin(`CRÍTICO: No se pudo conectar a la API de Gemini Live para la llamada ${callSid}.\nDetalle: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Construye el system prompt dinámico.
 * Cumple spec 7.4.
 */
function construirSystemPrompt(
  contexto: string,
  settings: NonNullable<
    Awaited<ReturnType<typeof db.businessSettings.findUnique>>
  >,
  callSid: string,
  modo: "inbound" | "outbound" = "inbound"
): string {
  const idiomaInstruccion = obtenerInstruccionIdioma(derivarIdiomaDeRegion(settings.aiRegion));
  const horarioTexto = formatearHorario(
    settings.businessHours as Record<string, { abierto: boolean; inicio: string | null; fin: string | null }>,
    settings.timezone
  );
  const modoCita =
    settings.bookingMode === "hours"
      ? `Las citas son por franjas horarias de ${settings.defaultDurationMinutes} minutos.`
      : `Las citas son por noches. Check-in: ${settings.checkInTime}, Check-out: ${settings.checkOutTime}.`;

  const recursos = settings.recursos as Array<{ id: string; nombre: string }>;

  const safeContexto = sanitizePrompt(contexto);
  const safeFormFields = sanitizeFormFields(settings.formFields);
  const safeRecursos = sanitizeRecursos(recursos);
  
  const fechaActual = new Date().toLocaleString("es-MX", { 
    timeZone: settings.timezone || "America/Mexico_City",
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });

  return `
${idiomaInstruccion}

${HUMANIZACION_BASE}

## MENTALIDAD REGIONAL
${obtenerRegion(settings.aiRegion).snippet}

## CONTEXTO DEL NEGOCIO
${safeContexto}

## FECHA Y HORA ACTUAL DEL NEGOCIO
Hoy es ${fechaActual} (Zona horaria: ${settings.timezone})

## REGLAS DE AGENDAMIENTO
- Modo: ${modoCita}
- Horario de atención: ${horarioTexto}
- ${settings.modo247 ? "NOTA IMPORTANTE: Si la fecha y hora actual está fuera del horario de atención, NO AGENDES. Solo informa el horario y ofrece tomar un mensaje." : ""}
- HOY es ${fechaActual}. Cuando el cliente diga fechas relativas (hoy, mañana, pasado mañana, "el lunes", "la próxima semana"), conviértelas SIEMPRE a la fecha exacta YYYY-MM-DD calculada a partir de HOY en la zona horaria del negocio. NUNCA agendes en el pasado.
- Antes de agendar SIEMPRE llama a consultar_disponibilidad con la fecha exacta. Agenda ÚNICAMENTE usando un horario de su resultado (usa disponibles_iso, son timestamps listos). Si el horario pedido no está disponible, ofrece los disponibles.
- Captura el servicio que pide el cliente y pásalo en el parámetro servicio de agendar_cita (debe existir en el CONTEXTO DEL NEGOCIO). Si no lo menciona, pregúntalo antes de confirmar.

## FORMULARIO DE DATOS
Debes recopilar: ${safeFormFields}

## RECURSOS DISPONIBLES
${safeRecursos}

## INSTRUCCIONES
- Sé amable, profesional y conciso.
- Antes de agendar, SIEMPRE consulta disponibilidad con la herramienta.
- Confirma los datos con el cliente antes de guardar.
- Si el cliente quiere cancelar, usa la herramienta de cancelación.
- NUNCA inventes información. Si un dato no está en el CONTEXTO DEL NEGOCIO o no lo sabes, dilo con honestidad y ofrece tomar un mensaje. Si no entiendes al cliente, pide amablemente que lo repita en lugar de suponer.
- Las herramientas se ejecutan en segundo plano, de forma invisible. Úsalas en silencio y entrega al cliente una sola respuesta natural con el resultado. Nunca menciones que estás consultando un sistema, ni digas frases de espera como "un momento" o "permíteme".
- Responde las consultas normales (servicios, precios, horarios, políticas) directamente desde el CONTEXTO DEL NEGOCIO, sin usar herramientas. Úsalas SOLO para consultar disponibilidad, agendar o cancelar citas.
- Cuando recibas el aviso de que la llamada se conectó, saluda PRIMERO tú, antes de esperar a que el cliente hable.${
    modo === "outbound"
      ? " ESTA ES UNA LLAMADA SALIENTE: el cliente contestó tu llamada. Preséntate como el asistente del negocio, explica brevemente el motivo (confirmación, seguimiento o información) y pregunta cómo puedes ayudar."
      : settings.mensajeSaludo
        ? ` Di exactamente este saludo (con tu voz y tono naturales): "${sanitizePrompt(settings.mensajeSaludo, 500)}"`
        : " Preséntate con el nombre del negocio, saluda amablemente y pregunta cómo puedes ayudar."
  }
- ID de llamada actual: ${callSid}
    `.trim();
}

function obtenerInstruccionIdioma(codigo: string): string {
  // Recomendación oficial de Gemini Live: forzar el idioma de forma inequívoca
  // en el system prompt para que el modelo NUNCA cambie de idioma en medio de la llamada.
  const idiomas: Record<string, string> = {
    es: "RESPOND IN SPANISH. YOU MUST RESPOND UNMISTAKABLY IN SPANISH. No cambies de idioma en toda la conversación. Habla en español de forma natural y amable.",
    en: "RESPOND IN ENGLISH. YOU MUST RESPOND UNMISTAKABLY IN ENGLISH. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    pt: "RESPOND IN PORTUGUESE. YOU MUST RESPOND UNMISTAKABLY IN PORTUGUESE. Não mude de idioma em toda a conversa. Fale de forma natural e amigável.",
    fr: "RESPOND IN FRENCH. YOU MUST RESPOND UNMISTAKABLY IN FRENCH. Ne change pas de langue pendant toute la conversation. Parle de façon naturelle et amicale.",
    it: "RESPOND IN ITALIAN. YOU MUST RESPOND UNMISTAKABLY IN ITALIAN. Non cambiare lingua durante tutta la conversazione. Parla in modo naturale e amichevole.",
    de: "RESPOND IN GERMAN. YOU MUST RESPOND UNMISTAKABLY IN GERMAN. Wechsle während des gesamten Gesprächs nicht die Sprache. Sprich natürlich und freundlich.",
    nl: "RESPOND IN DUTCH. YOU MUST RESPOND UNMISTAKABLY IN DUTCH. Wissel tijdens het hele gesprek niet van taal. Spreek natuurlijk en vriendelijk.",
    el: "RESPOND IN GREEK. YOU MUST RESPOND UNMISTAKABLY IN GREEK. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    sv: "RESPOND IN SWEDISH. YOU MUST RESPOND UNMISTAKABLY IN SWEDISH. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    nb: "RESPOND IN NORWEGIAN. YOU MUST RESPOND UNMISTAKABLY IN NORWEGIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    da: "RESPOND IN DANISH. YOU MUST RESPOND UNMISTAKABLY IN DANISH. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    fi: "RESPOND IN FINNISH. YOU MUST RESPOND UNMISTAKABLY IN FINNISH. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    pl: "RESPOND IN POLISH. YOU MUST RESPOND UNMISTAKABLY IN POLISH. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    cs: "RESPOND IN CZECH. YOU MUST RESPOND UNMISTAKABLY IN CZECH. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    sk: "RESPOND IN SLOVAK. YOU MUST RESPOND UNMISTAKABLY IN SLOVAK. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    hu: "RESPOND IN HUNGARIAN. YOU MUST RESPOND UNMISTAKABLY IN HUNGARIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    ro: "RESPOND IN ROMANIAN. YOU MUST RESPOND UNMISTAKABLY IN ROMANIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    bg: "RESPOND IN BULGARIAN. YOU MUST RESPOND UNMISTAKABLY IN BULGARIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    hr: "RESPOND IN CROATIAN. YOU MUST RESPOND UNMISTAKABLY IN CROATIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    sl: "RESPOND IN SLOVENIAN. YOU MUST RESPOND UNMISTAKABLY IN SLOVENIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    sr: "RESPOND IN SERBIAN. YOU MUST RESPOND UNMISTAKABLY IN SERBIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    sq: "RESPOND IN ALBANIAN. YOU MUST RESPOND UNMISTAKABLY IN ALBANIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    mk: "RESPOND IN MACEDONIAN. YOU MUST RESPOND UNMISTAKABLY IN MACEDONIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    lt: "RESPOND IN LITHUANIAN. YOU MUST RESPOND UNMISTAKABLY IN LITHUANIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    lv: "RESPOND IN LATVIAN. YOU MUST RESPOND UNMISTAKABLY IN LATVIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    et: "RESPOND IN ESTONIAN. YOU MUST RESPOND UNMISTAKABLY IN ESTONIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    is: "RESPOND IN ICELANDIC. YOU MUST RESPOND UNMISTAKABLY IN ICELANDIC. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    mt: "RESPOND IN MALTESE. YOU MUST RESPOND UNMISTAKABLY IN MALTESE. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    uk: "RESPOND IN UKRAINIAN. YOU MUST RESPOND UNMISTAKABLY IN UKRAINIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    ru: "RESPOND IN RUSSIAN. YOU MUST RESPOND UNMISTAKABLY IN RUSSIAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    tr: "RESPOND IN TURKISH. YOU MUST RESPOND UNMISTAKABLY IN TURKISH. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    ca: "RESPOND IN CATALAN. YOU MUST RESPOND UNMISTAKABLY IN CATALAN. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    ar: "RESPOND IN ARABIC. YOU MUST RESPOND UNMISTAKABLY IN ARABIC. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    hi: "RESPOND IN HINDI. YOU MUST RESPOND UNMISTAKABLY IN HINDI. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    zh: "RESPOND IN MANDARIN CHINESE. YOU MUST RESPOND UNMISTAKABLY IN MANDARIN CHINESE. Do not switch languages during the whole conversation. Speak naturally and friendly.",
    fil: "RESPOND IN FILIPINO. YOU MUST RESPOND UNMISTAKABLY IN FILIPINO. Do not switch languages during the whole conversation. Speak naturally and friendly.",
  };
  return idiomas[codigo] ?? idiomas.es;
}

/**
 * Sanitiza strings para prevenir inyección en prompts.
 * - Máx 10k chars
 * - Strip control chars (\x00-\x1F)
 * - Escape {{, }}, <script>, </script>
 */
function sanitizePrompt(input: string, maxLen: number = 10000): string {
  if (!input) return "";
  let out = input.slice(0, maxLen);
  out = out.replace(/[\x00-\x1F]/g, "");
  out = out.replace(/\{\{/g, "&#123;&#123;").replace(/\}\}/g, "&#125;&#125;");
  out = out.replace(/<script\b[^>]*>/gi, "<script>").replace(/<\/script>/gi, "</script>");
  return out;
}

function sanitizeFormFields(fields: unknown): string {
  try {
    const arr = fields as Array<{ key: string; label: string; type: string; required: boolean }>;
    if (!Array.isArray(arr)) return "[]";
    const sanitized = arr.slice(0, 20).map(f => ({
      key: String(f.key ?? "").slice(0, 50),
      label: String(f.label ?? "").slice(0, 100),
      type: String(f.type ?? "text").slice(0, 20),
      required: Boolean(f.required),
    }));
    return JSON.stringify(sanitized, null, 2);
  } catch {
    return "[]";
  }
}

function sanitizeRecursos(recursos: unknown): string {
  try {
    const arr = recursos as Array<{ id: string; nombre: string }>;
    if (!Array.isArray(arr)) return "[]";
    return JSON.stringify(arr.slice(0, 50).map(r => ({
      id: String(r.id ?? "").slice(0, 50),
      nombre: String(r.nombre ?? "").slice(0, 100),
    })), null, 2);
  } catch {
    return "[]";
  }
}

function formatearHorario(
  horario: Record<string, { abierto: boolean; inicio: string | null; fin: string | null }>,
  timezone: string
): string {
  const dias: Record<string, string> = {
    lunes: "Lunes",
    martes: "Martes",
    miercoles: "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes",
    sabado: "Sábado",
    domingo: "Domingo",
  };
  const partes: string[] = [];
  for (const [key, label] of Object.entries(dias)) {
    const h = horario[key];
    if (h?.abierto) {
      partes.push(`${label}: ${h.inicio} - ${h.fin}`);
    } else {
      partes.push(`${label}: cerrado`);
    }
  }
  return partes.join(", ") + ` (${timezone})`;
}

/**
 * Define las herramientas (function calling) disponibles para Gemini.
 * Cumple spec 7.6. El set se adapta a la configuración del negocio.
 */
function obtenerHerramientas(settings: {
  bookingMode: string;
  defaultDurationMinutes: number;
  checkInTime?: string;
  checkOutTime?: string;
  recursos?: unknown;
}) {
  const esModoNoches = settings.bookingMode === "nights";
  const duracion = settings.defaultDurationMinutes || 30;
  const modoTexto = esModoNoches
    ? "las citas son por noches (check-in y check-out) y el horario es de 24 horas"
    : `las citas son por franjas de ${duracion} minutos y solo dentro del horario de atención`;

  const recursos = Array.isArray(settings.recursos)
    ? (settings.recursos as Array<{ id: string; nombre: string }>).map((r) => r.nombre).slice(0, 10).join(", ")
    : "";

  return [
    {
      functionDeclarations: [
        {
          name: "consultar_disponibilidad",
          description:
            `Consulta citas agendadas para una fecha determinada. En ${modoTexto}. ` +
            `Retorna horarios ocupados, horarios libres (disponibles_iso son timestamps completos listos para agendar) y si el día está abierto. ` +
            `Usa la fecha que pida el cliente (hoy, mañana, etc.) en formato YYYY-MM-DD.`,
          parameters: {
            type: Type.OBJECT,
            properties: {
              date: {
                type: Type.STRING,
                description: "Fecha YYYY-MM-DD en la zona horaria del negocio",
              },
              recurso_id: {
                type: Type.STRING,
                description: "ID del recurso (opcional)",
              },
            },
            required: ["date"],
          },
        } as const,
        {
          name: "agendar_cita",
          description:
            `Agenda una nueva cita para un cliente. ${esModoNoches ? `Check-in ${settings.checkInTime}, check-out ${settings.checkOutTime}.` : `Duración de ${duracion} minutos, dentro del horario de atención.`} ` +
            "Usa start_time de los disponibles_iso que devolvió consultar_disponibilidad. Captura el servicio solicitado por el cliente del CONTEXTO DEL NEGOCIO.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: "Nombre del cliente" },
              customer_phone: { type: Type.STRING, description: "Teléfono del cliente (si lo dio)" },
              customer_email: { type: Type.STRING, description: "Email del cliente (si lo dio)" },
              start_time: {
                type: Type.STRING,
                description: "Inicio de la cita en ISO 8601 (usa disponibles_iso)",
              },
              end_time: {
                type: Type.STRING,
                description: "Fin de la cita en ISO 8601 (modo noches - opcional)",
              },
              duration_minutes: { type: Type.INTEGER, description: "Duración en minutos (opcional)" },
              recurso_id: { type: Type.STRING, description: "ID del recurso del negocio (opcional)" },
              servicio: {
                type: Type.STRING,
                description:
                  "Servicio que pidió el cliente (ej. corte de pelo, consulta). Debe estar en el CONTEXTO DEL NEGOCIO; si el cliente no lo menciona, pregúntalo antes de agendar.",
              },
              notes: { type: Type.STRING, description: "Notas adicionales (opcional)" },
            },
            required: ["customer_name", "start_time"],
          },
        } as const,
        {
          name: "cancelar_cita",
          description:
            "Cancela una cita existente buscando por nombre o teléfono del cliente.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING },
              customer_phone: { type: Type.STRING },
              date: {
                type: Type.STRING,
                description: "Fecha aproximada YYYY-MM-DD",
              },
            },
            required: ["customer_name"],
          },
        } as const,
        {
          name: "reagendar_cita",
          description:
            `Reagenda una cita existente de un cliente. ${esModoNoches ? `Check-in ${settings.checkInTime}, check-out ${settings.checkOutTime}.` : `Duración de ${duracion} minutos.`} ` +
            "Usa start_time de los disponibles_iso que devolvió consultar_disponibilidad. Si la nueva cita se agenda con éxito, la cita anterior se cancelará automáticamente de forma segura.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: "Nombre del cliente" },
              customer_phone: { type: Type.STRING, description: "Teléfono del cliente (si lo dio)" },
              start_time: {
                type: Type.STRING,
                description: "Inicio de la nueva cita en ISO 8601 (usa disponibles_iso)",
              },
              old_date: {
                type: Type.STRING,
                description: "Fecha aproximada de la cita anterior YYYY-MM-DD (opcional)",
              },
              servicio: {
                type: Type.STRING,
                description: "Servicio para la nueva cita",
              },
            },
            required: ["customer_name", "start_time"],
          },
        } as const,
        {
          name: "finalizar_llamada",
          description:
            "Úsala obligatoriamente cuando la conversación haya terminado de forma natural (luego de despedirte cordialmente) o cuando el cliente lleve mucho tiempo en silencio y no responda. Esta herramienta colgará la llamada de inmediato. Siempre despídete ANTES de usarla.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              reason: { type: Type.STRING, description: "Razón para colgar (ej. 'despedida', 'silencio', 'buzon_voz')" }
            },
            required: ["reason"],
          },
        } as const,
      ],
    },
  ];
}

/**
 * Ejecuta una herramienta (function call) y retorna el resultado en un formato
 * estándar con voice_instruction para que la IA sepa qué decirle al cliente.
 * Cumple spec 7.6 - function calling síncrono.
 */
export async function ejecutarHerramienta(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  callSid: string
): Promise<unknown> {
  const t0 = Date.now();
  logger.info({ name, args, userId, callSid }, "Ejecutando function call");

  const registrar = (status: string, data: unknown, voice_instruction: string) => {
    const durationMs = Date.now() - t0;
    if (durationMs > UMBRAL_TOOL_LENTA_MS) {
      logger.warn({ name, durationMs, callSid }, "Herramienta lenta");
    }
    emitirSSE(userId, "herramienta_usada", { callSid, name, args, status, data, voice_instruction, durationMs });
    db.callTranscript
      .create({
        data: {
          userId,
          callSid,
          rol: "tool",
          texto: `${name}(${JSON.stringify(args)}) → ${status}`,
        },
      })
      .catch((e) => logger.warn({ error: (e as Error).message }, "Error guardando transcript de herramienta"));
    return { status, data, voice_instruction, durationMs };
  };

  // Deduplicación de herramientas mutantes (evita doble ejecución en retries)
  let firma = "";
  if (HERRAMIENTAS_MUTANTES.has(name)) {
    firma = `${callSid}|${firmaHerramienta(name, args)}`;
    if (dedupHerramientas.yaEjecutada(firma)) {
      logger.info({ name, callSid }, "Herramienta duplicada omitida");
      return registrar(
        "duplicado",
        { error: "duplicado" },
        "Eso ya lo procesé hace un momento. Confirma con el cliente el estado actual o si desea otra cosa."
      );
    }
  }

  try {
    switch (name) {
      case "consultar_disponibilidad": {
        const { date, recurso_id } = args as { date: string; recurso_id?: string };
        const resultado = await conTimeout(
          consultarDisponibilidad(userId, date, recurso_id),
          TIMEOUTS[name] ?? TIMEOUT_DEFAULT
        );
        if (!resultado.abierto) {
          return registrar(
            "error",
            resultado,
            "Ese día estamos cerrados. Menciona nuestro horario de atención y ofrece revisar otro día."
          );
        }
        return registrar(
          "ok",
          resultado,
          "Ya tengo los horarios disponibles para esa fecha. Ofrece el primero que le convenga al cliente y confirma antes de agendar."
        );
      }

      case "agendar_cita": {
        const params = args as {
          customer_name: string;
          customer_phone?: string;
          customer_email?: string;
          start_time: string;
          end_time?: string;
          duration_minutes?: number;
          recurso_id?: string;
          servicio?: string;
          notes?: string;
        };
        if (!params.customer_name || !params.start_time) {
          return registrar(
            "error",
            { error: "faltan_datos" },
            "Faltan datos para agendar (nombre o fecha). Pregunta amablemente lo que falte al cliente."
          );
        }
        // Marcar antes de ejecutar: si la operación tarda y el modelo reintenta,
        // el retry se omite en vez de crear una cita doble.
        dedupHerramientas.marcar(firma);
        const resultado = await conTimeout(
          agendarCita({
            userId,
            customerName: params.customer_name,
            customerPhone: params.customer_phone,
            customerEmail: params.customer_email,
            startTime: new Date(params.start_time),
            endTime: params.end_time ? new Date(params.end_time) : undefined,
            durationMinutes: params.duration_minutes,
            recursoId: params.recurso_id,
            servicio: params.servicio,
            notes: params.notes,
          }),
          TIMEOUTS[name] ?? TIMEOUT_DEFAULT
        );
        if (resultado.ok === false) {
          const instrucciones: Record<string, string> = {
            day_closed: "Ese día no atendemos. Informa el horario de atención y ofrece revisar otro día.",
            fuera_horario: "Esa hora está fuera de nuestro horario de atención. Muestra las opciones dentro del horario disponible.",
            overlap: "Ese horario acaba de ocuparse. Permíteme ofrecerte otra opción disponible.",
            sin_settings: "No puedo agendar en este momento. Pide una disculpa y ofrece tomar los datos o un mensaje.",
          };
          return registrar(
            "error",
            { error: resultado.error, detalle: resultado.detalle },
            instrucciones[resultado.error] ?? "No se pudo agendar. Pide disculpas y ofrece revisar otra fecha u hora."
          );
        }
        // Notificar al dueño via SSE
        emitirSSE(userId, "nueva_cita", {
          cita: resultado.cita,
          callSid,
        });
        const fechaCita = new Date(params.start_time).toLocaleString("es-MX", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        });
        return registrar(
          "ok",
          {
            cita_id: resultado.cita.id,
            servicio: params.servicio ?? null,
            start_time: params.start_time,
          },
          `Listo, la cita queda agendada para ${params.customer_name} el ${fechaCita}${params.servicio ? ` para el servicio de ${params.servicio}` : ""}. Confírmale los datos y despídete amablemente.`
        );
      }

      case "reagendar_cita": {
        const params = args as {
          customer_name: string;
          customer_phone?: string;
          customer_email?: string;
          old_date?: string;
          start_time: string;
          end_time?: string;
          duration_minutes?: number;
          recurso_id?: string;
          servicio?: string;
          notes?: string;
        };
        if (!params.customer_name || !params.start_time) {
          return registrar(
            "error",
            { error: "faltan_datos" },
            "Faltan datos para reagendar (nombre o nueva fecha). Pregúntale amablemente lo que falte al cliente."
          );
        }
        dedupHerramientas.marcar(firma);
        const resultado = await conTimeout(
          reagendarCita({
            userId,
            customerName: params.customer_name,
            customerPhone: params.customer_phone,
            customerEmail: params.customer_email,
            oldDate: params.old_date,
            newStartTime: params.start_time,
            newEndTime: params.end_time,
            durationMinutes: params.duration_minutes,
            recursoId: params.recurso_id,
            servicio: params.servicio,
            notes: params.notes,
          }),
          TIMEOUTS[name] ?? TIMEOUT_DEFAULT
        );
        if (resultado.ok === false) {
          const instrucciones: Record<string, string> = {
            day_closed: "Ese día no atendemos. Informa el horario de atención y ofrece otra fecha.",
            fuera_horario: "Esa hora está fuera de horario. Ofrece opciones dentro del horario disponible.",
            overlap: "Ese horario ya se ocupó. Permíteme ofrecerte otra opción disponible.",
            sin_settings: "No puedo reagendar en este momento. Pide una disculpa.",
          };
          return registrar(
            "error",
            { error: resultado.error, detalle: resultado.detalle },
            instrucciones[resultado.error] ?? "No se pudo agendar en ese nuevo horario. Pide disculpas y ofrece revisar otra fecha."
          );
        }
        
        emitirSSE(userId, "nueva_cita", {
          cita: resultado.cita,
          callSid,
        });
        
        const fechaCita = new Date(params.start_time).toLocaleString("es-MX", {
          weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
        });
        
        if (resultado.canceladas === 0) {
          return registrar(
            "ok",
            { cita_id: resultado.cita.id, canceladas: 0 },
            `Logré agendar la cita para el ${fechaCita}, PERO no encontré la cita anterior para cancelarla. Confírmale al cliente la nueva cita y dile que revisaremos lo de su cita anterior manualmente.`
          );
        }
        
        return registrar(
          "ok",
          { cita_id: resultado.cita.id, canceladas: resultado.canceladas },
          `Perfecto, reagendamiento exitoso. La cita anterior fue cancelada y la nueva quedó para el ${fechaCita}. Confírmaselo al cliente de forma amable.`
        );
      }

      case "cancelar_cita": {
        const params = args as {
          customer_name?: string;
          customer_phone?: string;
          date?: string;
        };
        if (!params.customer_name && !params.customer_phone) {
          return registrar(
            "error",
            { error: "faltan_datos" },
            "Faltan datos para buscar la cita. Pide el nombre o teléfono del cliente."
          );
        }
        dedupHerramientas.marcar(firma);
        const { canceladas } = await conTimeout(
          cancelarCita({
            userId,
            customerName: params.customer_name,
            customerPhone: params.customer_phone,
            date: params.date,
          }),
          TIMEOUTS[name] ?? TIMEOUT_DEFAULT
        );
        if (canceladas === 0) {
          return registrar(
            "error",
            { canceladas: 0 },
            "No encontré una cita con esos datos. Pide el nombre y teléfono exactos del cliente para buscarla de nuevo."
          );
        }
        return registrar(
          "ok",
          { canceladas },
          "La cita fue cancelada. Confirma al cliente que quedó cancelada y pregunta si necesita algo más."
        );
      }

      case "finalizar_llamada": {
        const params = args as { reason: string };
        logger.info({ callSid, reason: params.reason }, "IA solicita finalizar la llamada");
        
        // Esperamos exactamente hasta que el último bit de audio generado por la IA
        // termine de reproducirse en el teléfono del cliente + 500ms de gracia.
        const tiempoRestante = obtenerTiempoRestanteAudio(callSid);
        const timeoutFinal = tiempoRestante + 500;
        logger.info({ callSid, timeoutFinal }, `Programando hangup basado en duración real del audio restante`);
        
        setTimeout(() => {
          hangupCall(callSid).catch(e => logger.error({ error: (e as Error).message }, "Error en hangupCall desde finalizar_llamada"));
          cerrarLlamadaWebSocket(callSid);
        }, timeoutFinal);
        
        return registrar(
          "ok",
          { status: "hanging_up" },
          "Cortando la llamada. Ya no digas nada más."
        );
      }

      default:
        logger.warn({ name }, "Herramienta desconocida");
        return registrar("error", { error: `Herramienta ${name} no implementada` }, "Disculpa, no pude completar eso. ¿Puedes repetirlo?");
    }
  } catch (e) {
    const mensaje = (e as Error).message;
    const esTimeout = mensaje?.startsWith("Timeout");
    logger.error({ error: mensaje, name }, "Error ejecutando herramienta");
    return registrar(
      "timeout",
      { error: mensaje },
      esTimeout
        ? "El sistema está tardando más de lo normal. Pide una disculpa breve, no confirmes todavía y pregunta si puede esperar unos segundos mientras verificas."
        : "Hubo un problema al procesar tu solicitud. Pide disculpas y ofrece intentarlo de nuevo o tomar un mensaje."
    );
  }
}

/**
 * Loop principal de recepción de mensajes de Gemini.
 * Procesa audio, transcripciones y function calls.
 * Cumple spec 7.6.
 */
export async function procesarMensajesGemini(
  session: SesionGemini,
  userId: string,
  callSid: string,
  streamSid: string,
  enviarATelnyx: (streamSid: string, audioBase64: string) => void,
  onTranscripcion?: (texto: string, rol: string, ts: number) => void,
  mensajeInicial?: string
): Promise<void> {
  let inicioTurno = Date.now();
  let saludoEnviado = false;
  let primeraRespuestaRegistrada = false;
  let tsPrimerAudio = 0;

  session.on("message", async (data) => {
    try {
      let msg: any = data;
      if (Buffer.isBuffer(data)) {
        msg = JSON.parse(data.toString("utf-8"));
      } else if (typeof data === "string") {
        msg = JSON.parse(data);
      }

      // Al quedar lista la sesión, disparar el primer turno para que la IA
      // salude sin esperar a que el cliente hable.
      if (msg.setupComplete && mensajeInicial && !saludoEnviado) {
        logger.info(`[GEMINI API] 🟢 setupComplete recibido de Google. Esperando 1.5s para enviar instrucción inicial (Telnyx audio channel setup)...`);
        saludoEnviado = true;
        setTimeout(() => {
          if (session.readyState === WS.OPEN) {
            session.send(
              JSON.stringify({
                clientContent: {
                  turns: [{ role: "user", parts: [{ text: mensajeInicial }] }],
                  turnComplete: true,
                },
              })
            );
            logger.info({ callSid }, `[GEMINI API] 🗣️ Instrucción inicial enviada a la IA: "${mensajeInicial.substring(0, 80)}..."`);
          }
        }, 1500);
      }

      if (msg.serverContent && msg.serverContent.modelTurn && msg.serverContent.modelTurn.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          // Audio de respuesta
          if (part.inlineData && part.inlineData.mimeType?.startsWith("audio")) {
            const mulaw8k = await transcodificarGeminiATelefonía(part.inlineData.data);
            if (mulaw8k.length === 0) continue;
            logger.debug({ callSid, bytes: mulaw8k.length }, "[GEMINI API] 🔊 Audio generado por la IA enviado a Telnyx");
            enviarATelnyx(streamSid, mulaw8k);
            
            // Grabar el audio generado en el canal derecho (IA)
            agregarChunkOutbound(callSid, Buffer.from(mulaw8k, "base64"));
            
            // Registrar latencia solo una vez por turno (primer chunk de la respuesta)
            if (!primeraRespuestaRegistrada) {
              primeraRespuestaRegistrada = true;
              tsPrimerAudio = Date.now();
              const primerAudioMs = tsPrimerAudio - inicioTurno;
              logger.info({ callSid, primerAudioMs }, "Primer audio de respuesta (Gemini)");
              registrarLatencia(primerAudioMs);
            }
          }

          // Transcripción
          if (part.text) {
            emitirSSE(userId, "transcripcion", { callSid, texto: part.text, rol: "ai" });
            logger.info({ callSid, texto: part.text }, "Transcripción IA");
            onTranscripcion?.(part.text, "ai", Date.now());
          }

          // Function Call (protocolo 2.x - fallback)
          if (part.functionCall) {
            const { name, args } = part.functionCall;
            await responderFunctionCall(session, undefined, name, args, userId, callSid);
          }
        }
      }

      // Function Call (protocolo Gemini 3.x): llega como mensaje separado
      // `toolCall.functionCalls` con `id`. Hay que responder con `toolResponse`.
      if (msg.toolCall && msg.toolCall.functionCalls) {
        for (const call of msg.toolCall.functionCalls) {
          await responderFunctionCall(
            session,
            call.id,
            call.name,
            call.args as Record<string, unknown>,
            userId,
            callSid
          );
        }
      }

      // Turno completo
      if (msg.serverContent?.turnComplete) {
        const ahoraTurno = Date.now();
        const turnoTotalMs = ahoraTurno - inicioTurno;
        const primerAudioMs = tsPrimerAudio ? tsPrimerAudio - inicioTurno : null;
        logger.info(
          {
            callSid,
            turnoTotalMs,
            primerAudioMs,
            gapAudioATurnoMs: primerAudioMs != null ? ahoraTurno - tsPrimerAudio : null,
          },
          "Turno Gemini completado"
        );
        // Iniciar la medición del siguiente turno desde aquí
        inicioTurno = Date.now();
        primeraRespuestaRegistrada = false;
        tsPrimerAudio = 0;
      }
    } catch (e) {
      logger.error({ error: (e as Error).message, callSid }, "Error en loop de Gemini");
    }
  });
}

/**
 * Ejecuta una herramienta solicitada por el modelo y le responde usando el
 * protocolo correcto según cómo llegó el call:
 * - 2.x: `clientContent.turns[].parts[].functionResponse` (sin id)
 * - 3.x: `toolResponse.functionResponses[{ id, name, response }]` (con id)
 * La presencia de `id` indica protocolo 3.x.
 */
async function responderFunctionCall(
  session: SesionGemini,
  id: string | undefined,
  name: string,
  args: Record<string, unknown>,
  userId: string,
  callSid: string
): Promise<void> {
  logger.info({ callSid, name }, `[GEMINI API] 🛠️ Herramienta solicitada por la IA: ${name}`);
  const resultado = await ejecutarHerramienta(name, args, userId, callSid);

  if (session.readyState !== WS.OPEN) return;

  if (id) {
    // Protocolo Gemini 3.x
    session.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: [{ id, name, response: resultado }],
        },
      })
    );
  } else {
    // Protocolo Gemini 2.x (fallback)
    session.send(
      JSON.stringify({
        clientContent: {
          turnComplete: true,
          turns: [
            {
              role: "user",
              parts: [{ functionResponse: { name, response: resultado } }],
            },
          ],
        },
      })
    );
  }
}
