import { Type } from "@google/genai";
import { WebSocket as WS } from "ws";
import { db } from "../models/database.pool";
import { obtenerContextoRAG } from "../services/rag.service";
import { agendarCita, cancelarCita, consultarDisponibilidad } from "../services/calendar.service";
import { transcodificarGeminiATelefonía } from "../utils/audioTranscoder";
import { emitirSSE } from "../sse/events.emitter";
import { registrarLatencia, enviarAlertaAdmin } from "../services/monitoring.service";
import { actualizarRateLimitGemini } from "../services/ratelimit.service";
import { vadConfigManager } from "../services/vad.service";
import { logger } from "../utils/logger";

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

  // Obtener contexto del negocio + settings (con búsqueda pgvector RAG)
  const settings = await db.businessSettings.findUnique({ where: { userId } });
  const consultaBase = settings?.systemPromptContext || "información del negocio";
  const contexto = await obtenerContextoRAG(userId, consultaBase);
  if (!settings) {
    logger.error({ userId }, "Settings no encontradas al crear sesión Gemini");
    return null;
  }

  const systemPrompt = construirSystemPrompt(contexto, settings, callSid, modo);
  const herramientas = obtenerHerramientas(settings);
  const aiVoice = settings.aiVoice || "Puck";
  const vadCfg = await vadConfigManager.getConfig();
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
  const idiomaInstruccion = obtenerInstruccionIdioma(settings.aiLanguage);
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
- Cuando vayas a usar una herramienta, ANTES di una frase breve y natural para cubrir la espera, variando entre sinónimos: "Un momento, por favor", "Permíteme un segundo", "Dame un instante para verificarlo". Después retoma la conversación con el resultado.
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
  const idiomas: Record<string, string> = {
    es: "Habla en español de forma natural y amable.",
    en: "Speak in English naturally and friendly.",
    pt: "Fale em português de forma natural e amigável.",
    fr: "Parlez en français de façon naturelle et amicale.",
    it: "Parla in italiano in modo naturale e amichevole.",
    de: "Sprich auf Deutsch natürlich und freundlich.",
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
  logger.info({ name, args, userId, callSid }, "Ejecutando function call");

  const registrar = (status: "ok" | "error", data: unknown, voice_instruction: string) => {
    emitirSSE(userId, "herramienta_usada", { callSid, name, args, status, data, voice_instruction });
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
    return { status, data, voice_instruction };
  };

  try {
    switch (name) {
      case "consultar_disponibilidad": {
        const { date, recurso_id } = args as { date: string; recurso_id?: string };
        const resultado = await consultarDisponibilidad(userId, date, recurso_id);
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
        const resultado = await agendarCita({
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
        });
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

      case "cancelar_cita": {
        const params = args as {
          customer_name?: string;
          customer_phone?: string;
          date?: string;
        };
        const { canceladas } = await cancelarCita({
          userId,
          customerName: params.customer_name,
          customerPhone: params.customer_phone,
          date: params.date,
        });
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

      default:
        logger.warn({ name }, "Herramienta desconocida");
        return registrar("error", { error: `Herramienta ${name} no implementada` }, "Disculpa, no pude completar eso. ¿Puedes repetirlo?");
    }
  } catch (e) {
    logger.error({ error: (e as Error).message, name }, "Error ejecutando herramienta");
    return registrar(
      "error",
      { error: (e as Error).message },
      "Hubo un problema al procesar tu solicitud. Pide disculpas y ofrece intentarlo de nuevo o tomar un mensaje."
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
        logger.info(`[GEMINI API] 🟢 setupComplete recibido de Google. Preparando para enviar instrucción inicial...`);
        saludoEnviado = true;
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
      }

      if (msg.serverContent && msg.serverContent.modelTurn && msg.serverContent.modelTurn.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          // Audio de respuesta
          if (part.inlineData && part.inlineData.mimeType?.startsWith("audio")) {
            const mulaw8k = await transcodificarGeminiATelefonía(part.inlineData.data);
            if (mulaw8k.length === 0) continue;
            logger.debug({ callSid, bytes: mulaw8k.length }, "[GEMINI API] 🔊 Audio generado por la IA enviado a Telnyx");
            enviarATelnyx(streamSid, mulaw8k);
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

          // Function Call
          if (part.functionCall) {
            const { name, args } = part.functionCall;
            logger.info({ callSid, name }, `[GEMINI API] 🛠️ Herramienta solicitada por la IA: ${name}`);
            const resultado = await ejecutarHerramienta(
              name,
              args as Record<string, unknown>,
              userId,
              callSid
            );

            // RESPONDER a Gemini (enviando el mensaje de vuelta)
            if (session.readyState === WS.OPEN) {
              session.send(JSON.stringify({
                clientContent: {
                  turnComplete: true,
                  turns: [{
                    role: "user",
                    parts: [{
                      functionResponse: {
                        name: name,
                        response: resultado
                      }
                    }]
                  }]
                }
              }));
            }
          }
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
