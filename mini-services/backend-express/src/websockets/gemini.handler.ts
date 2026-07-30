/**
 * Handler de Gemini Live API.
 * Cumple spec sección 7.3, 7.4, 7.6.
 *
 * Crea sesión bidireccional de audio con Gemini 3.1 Flash Live.
 * Maneja:
 * - System prompt dinámico (con contexto RAG + reglas de negocio)
 * - Function calling síncrono (consultar_disponibilidad, agendar_cita, cancelar_cita)
 * - Barge-in (interrupción)
 * - Transcodificación de audio
 */
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Session } from "@google/genai";
import { db } from "../models/database.pool";
import { obtenerContextoNegocio } from "../services/rag.service";
import { agendarCita, cancelarCita, consultarDisponibilidad } from "../services/calendar.service";
import { transcodificarGeminiATwilio } from "../utils/audioTranscoder";
import { emitirSSE } from "../sse/events.emitter";
import { registrarLatencia } from "../services/monitoring.service";
import { logger } from "../utils/logger";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const MODELO = "gemini-2.0-flash-exp"; // gemini-3.1-flash-live-preview en prod

export type SesionGemini = Session;

/**
 * Crea una sesión de Gemini Live para una llamada entrante.
 * Cumple spec 7.3.
 */
export async function crearSesionGemini(
  userId: string,
  callSid: string,
  streamSid: string
): Promise<SesionGemini | null> {
  if (!ai) {
    logger.warn({ callSid }, "GEMINI_API_KEY no configurada - sesión simulada");
    return null;
  }

  // Obtener contexto del negocio + settings
  const contexto = await obtenerContextoNegocio(userId);
  const settings = await db.businessSettings.findUnique({ where: { userId } });
  if (!settings) {
    logger.error({ userId }, "Settings no encontradas al crear sesión Gemini");
    return null;
  }

  const systemPrompt = construirSystemPrompt(contexto, settings, callSid);
  const herramientas = obtenerHerramientas();

  try {
    const session = await ai.live.connect({
      model: MODELO,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: herramientas,
        thinkingConfig: { thinkingLevel: "MINIMAL" },
      },
    });

    logger.info({ callSid, streamSid, userId }, "Sesión Gemini Live creada");
    return session as SesionGemini;
  } catch (e) {
    logger.error({ error: (e as Error).message, callSid }, "Error creando sesión Gemini");
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
  callSid: string
): string {
  const idiomaInstruccion = obtenerInstruccionIdioma(settings.aiLanguage);
  const horarioTexto = formatearHorario(
    JSON.parse(settings.businessHours) as Record<string, { abierto: boolean; inicio: string | null; fin: string | null }>,
    settings.timezone
  );
  const modoCita =
    settings.bookingMode === "hours"
      ? `Las citas son por franjas horarias de ${settings.defaultDurationMinutes} minutos.`
      : `Las citas son por noches. Check-in: ${settings.checkInTime}, Check-out: ${settings.checkOutTime}.`;

  const recursos = JSON.parse(settings.recursos) as Array<{ id: string; nombre: string }>;

  return `
${idiomaInstruccion}

## CONTEXTO DEL NEGOCIO
${contexto}

## REGLAS DE AGENDAMIENTO
- Modo: ${modoCita}
- Horario de atención: ${horarioTexto}
- Zona horaria: ${settings.timezone}
- ${settings.modo247 ? "Fuera de horario: informa el horario pero NO agendes. Ofrece tomar un mensaje." : ""}

## FORMULARIO DE DATOS
Debes recopilar: ${settings.formFields}

## RECURSOS DISPONIBLES
${recursos.length > 0 ? JSON.stringify(recursos, null, 2) : "No hay recursos específicos. Agenda por tiempo."}

## INSTRUCCIONES
- Sé amable, profesional y conciso.
- Antes de agendar, SIEMPRE consulta disponibilidad con la herramienta.
- Confirma los datos con el cliente antes de guardar.
- Si el cliente quiere cancelar, usa la herramienta de cancelación.
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
        },
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
              duration_minutes: { type: Type.INTEGER },
              recurso_id: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: ["customer_name", "start_time"],
          },
        },
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
        },
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
          durationMinutes: params.duration_minutes,
          recursoId: params.recurso_id,
          notes: params.notes,
        });
        if (!resultado.ok) {
          return { error: resultado.error, conflictoCon: resultado.conflictoCon };
        }
        // Notificar al dueño via SSE
        emitirSSE(userId, "nueva_cita", {
          cita: resultado.cita,
          callSid,
        });
        return {
          ok: true,
          cita_id: resultado.cita.id,
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
  enviarATwilio: (streamSid: string, audioBase64: string) => void
): Promise<void> {
  const inicioTurno = Date.now();

  try {
    for await (const message of session.receive()) {
      const parts = message.serverContent?.modelTurn?.parts;
      if (!parts) continue;

      for (const part of parts) {
        // Audio de respuesta
        if (part.inlineData?.mimeType?.startsWith("audio/")) {
          const pcm24k = Buffer.from(part.inlineData.data!, "base64");
          const mulaw8k = transcodificarGeminiATwilio(part.inlineData.data!);
          enviarATwilio(streamSid, mulaw8k);
          registrarLatencia(Date.now() - inicioTurno);
        }

        // Transcripción
        if (part.text) {
          emitirSSE(userId, "transcripcion", { callSid, texto: part.text, rol: "ai" });
          logger.info({ callSid, texto: part.text }, "Transcripción IA");
        }

        // Function Call (síncrono - bloqueante)
        if (part.functionCall) {
          const { name, args } = part.functionCall;
          const resultado = await ejecutarHerramienta(
            name!,
            args as Record<string, unknown>,
            userId,
            callSid
          );

          // RESPONDER a Gemini (bloqueante - el modelo espera esto)
          await session.sendRealtimeInput({
            functionResponses: [
              {
                name: name!,
                response: { result: resultado },
              },
            ],
          });
        }
      }

      // Turno completo
      if (message.serverContent?.turnComplete) {
        logger.info({ callSid, latencia: Date.now() - inicioTurno }, "Turno Gemini completado");
      }
    }
  } catch (e) {
    logger.error({ error: (e as Error).message, callSid }, "Error en loop de Gemini");
  }
}

export { ai };
