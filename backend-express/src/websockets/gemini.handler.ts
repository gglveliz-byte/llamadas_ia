import { Type } from "@google/genai";
import { WebSocket as WS } from "ws";
import { db } from "../models/database.pool";
import { obtenerContextoRAG } from "../services/rag.service";
import { agendarCita, cancelarCita, consultarDisponibilidad } from "../services/calendar.service";
import { transcodificarGeminiATelefonía } from "../utils/audioTranscoder";
import { emitirSSE } from "../sse/events.emitter";
import { registrarLatencia, enviarAlertaAdmin } from "../services/monitoring.service";
import { actualizarRateLimitGemini } from "../services/ratelimit.service";
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
  const herramientas = obtenerHerramientas();
  const aiVoice = settings.aiVoice || "Puck";

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
          tools: [{ functionDeclarations: herramientas[0].functionDeclarations }]
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
 * Cumple spec 7.6.
 */
function obtenerHerramientas() {
  return [
    {
      functionDeclarations: [
        {
          name: "consultar_disponibilidad",
          description:
            "Consulta citas agendadas para una fecha. Retorna horarios ocupados y libres.",
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
            "Agenda una nueva cita. Verifica que no haya conflicto antes de guardar.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING },
              customer_phone: { type: Type.STRING },
              customer_email: { type: Type.STRING },
              start_time: {
                type: Type.STRING,
                description: "ISO 8601 con timezone",
              },
              end_time: {
                type: Type.STRING,
                description: "ISO 8601 (modo noches - opcional)",
              },
              duration_minutes: { type: Type.INTEGER },
              recurso_id: { type: Type.STRING },
              notes: { type: Type.STRING },
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
 * Ejecuta una herramienta (function call) y retorna el resultado.
 * Cumple spec 7.6 - function calling síncrono.
 */
export async function ejecutarHerramienta(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  callSid: string
): Promise<unknown> {
  logger.info({ name, args, userId, callSid }, "Ejecutando function call");

  try {
    switch (name) {
      case "consultar_disponibilidad": {
        const { date, recurso_id } = args as { date: string; recurso_id?: string };
        return await consultarDisponibilidad(userId, date, recurso_id);
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
          notes?: string;
        };
        const resultado = await agendarCita({
          userId,
          customerName: params.customer_name,
          customerPhone: params.customer_phone,
          customerEmail: params.customer_email,
          startTime: new Date(params.start_time),
          endTime: params.end_time ? new Date(params.end_time) : undefined,
          durationMinutes: params.duration_minutes,
          recursoId: params.recurso_id,
          notes: params.notes,
        });
        if (!(resultado as any).ok) {
          return { error: (resultado as any).error, conflictoCon: (resultado as any).conflictoCon };
        }
        // Notificar al dueño via SSE
        emitirSSE(userId, "nueva_cita", {
          cita: (resultado as any).cita,
          callSid,
        });
        return {
          ok: true,
          cita_id: (resultado as any).cita.id,
          mensaje: `Cita agendada para ${params.customer_name} el ${new Date(params.start_time).toLocaleString("es-MX")}`,
        };
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
        return {
          ok: canceladas > 0,
          canceladas,
          mensaje:
            canceladas > 0
              ? `${canceladas} cita(s) cancelada(s)`
              : "No se encontró cita para cancelar",
        };
      }

      default:
        logger.warn({ name }, "Herramienta desconocida");
        return { error: `Herramienta ${name} no implementada` };
    }
  } catch (e) {
    logger.error({ error: (e as Error).message, name }, "Error ejecutando herramienta");
    return { error: (e as Error).message };
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
  const inicioTurno = Date.now();
  let saludoEnviado = false;

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
            logger.info({ callSid, bytes: mulaw8k.length }, "[GEMINI API] 🔊 Audio generado por la IA enviado a Telnyx");
            enviarATelnyx(streamSid, mulaw8k);
            registrarLatencia(Date.now() - inicioTurno);
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
        logger.info({ callSid, latencia: Date.now() - inicioTurno }, "Turno Gemini completado");
      }
    } catch (e) {
      logger.error({ error: (e as Error).message, callSid }, "Error en loop de Gemini");
    }
  });
}
