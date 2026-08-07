/**
 * Webhooks de Telnyx - Voice API (Call Control).
 * Usa la API REST de Call Control para contestar y conectar streaming,
 * en vez de devolver TeXML (que solo funciona con conexiones tipo TeXML).
 * 
 * POST /webhooks/telnyx/voice
 * Recibe TODOS los eventos: call.initiated, call.answered, call.hangup, etc.
 * Responde siempre 200 OK y ejecuta comandos via Call Control API.
 */
import { Router } from "express";
import { z } from "zod";
import { db } from "../models/database.pool";
import { validarFirmaTelnyx } from "../middleware/telnyxSignature";
import { verificarSaldo } from "../services/billing.service";
import { answerCall, hangupCall, startStreaming } from "../services/telnyx.service";
import { logger } from "../utils/logger";

const telnyxVoiceSchema = z.object({
  event_type: z.string(),
  payload: z.object({
    call_control_id: z.string(),
    call_session_id: z.string().optional(),
    call_leg_id: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    direction: z.string().optional(),
    state: z.string().optional(),
    client_state: z.string().optional(),
  }),
});

export const telnyxRouter = Router();

/**
 * Cache en memoria para asociar call_control_id → { userId, dir }.
 * Se llena en call.initiated y se consume en call.answered.
 * Se limpia en call.hangup o tras 10 minutos.
 */
const pendingCalls = new Map<string, { userId: string; dir: "inbound" | "outbound" }>();

// Limpiar llamadas pendientes viejas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [id] of pendingCalls) {
    // Las entradas no tienen timestamp aquí, así que simplemente
    // limitamos el tamaño del Map para evitar leaks
    if (pendingCalls.size > 500) {
      pendingCalls.delete(id);
    }
  }
}, 5 * 60 * 1000);

/**
 * POST /webhooks/telnyx/voice
 * Handler unificado para TODOS los eventos de Call Control.
 * Responde siempre 200 OK (Telnyx ignora el body en Voice API).
 * Los comandos se ejecutan via Call Control API REST.
 */
telnyxRouter.post("/voice", validarFirmaTelnyx, async (req, res) => {
  // SIEMPRE responder 200 inmediatamente para que Telnyx no reintente
  res.status(200).send("OK");

  const parsed = telnyxVoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, "Webhook Telnyx con datos inválidos");
    return;
  }

  const { event_type, payload } = parsed.data;
  const { call_control_id, from, to, direction, client_state } = payload;

  logger.info({ event_type, call_control_id, from, to, direction }, "Webhook Telnyx voz recibido");

  try {
    switch (event_type) {
      case "call.initiated":
        await handleCallInitiated(call_control_id, from, to, direction, client_state);
        break;

      case "call.answered":
        await handleCallAnswered(call_control_id, client_state);
        break;

      case "call.hangup":
        await handleCallHangup(call_control_id);
        pendingCalls.delete(call_control_id);
        break;

      case "call.streaming.started":
        logger.info({ call_control_id }, "✅ Streaming WebSocket iniciado correctamente");
        break;

      case "call.streaming.stopped":
        logger.info({ call_control_id }, "Streaming WebSocket detenido");
        break;

      default:
        logger.debug({ event_type, call_control_id }, "Evento Call Control no manejado");
    }
  } catch (e) {
    logger.error({ error: (e as Error).message, event_type, call_control_id }, "Error procesando webhook Telnyx");
  }
});

/**
 * Maneja call.initiated: valida negocio, contesta la llamada.
 * El streaming se inicia cuando llega call.answered.
 */
async function handleCallInitiated(
  callControlId: string,
  from: string | undefined,
  to: string | undefined,
  direction: string | undefined,
  clientState: string | undefined
): Promise<void> {
  // ── Llamadas salientes ──
  if (direction === "outgoing") {
    let userId: string | undefined;
    if (clientState) {
      const decodificado = Buffer.from(clientState, "base64").toString("utf8");
      userId = /^[0-9a-fA-F-]{36}$/.test(decodificado) ? decodificado : clientState;
    }
    if (!userId) {
      logger.warn({ callControlId }, "Llamada saliente sin client_state");
      return;
    }

    const saldoOk = await verificarSaldo(userId);
    if (!saldoOk) {
      logger.warn({ callControlId, userId }, "Llamada saliente rechazada por saldo insuficiente");
      await hangupCall(callControlId).catch(() => {});
      return;
    }

    // Guardar contexto para cuando la otra parte conteste
    pendingCalls.set(callControlId, { userId, dir: "outbound" });
    logger.info({ callControlId, userId }, "Llamada saliente registrada - esperando call.answered");
    return;
  }

  // ── Llamadas entrantes ──
  if (direction !== "incoming") {
    logger.info({ direction, callControlId }, "Dirección no procesada");
    return;
  }

  // 1. Buscar usuario por número destino (to)
  const phone = await db.phoneNumber.findFirst({
    where: { phoneNumber: to, isActive: true },
    include: { user: true },
  });

  if (!phone?.user) {
    logger.warn({ to }, "Número no registrado - rechazando llamada");
    await hangupCall(callControlId).catch(() => {});
    return;
  }

  const userId = phone.user.id;

  // 2. Verificar mantenimiento global
  const mantenimiento = await db.adminConfig.findUnique({
    where: { clave: "mensaje_mantenimiento" },
  });
  if (mantenimiento?.valor) {
    logger.info({ callControlId }, "Llamada rechazada por mantenimiento");
    await hangupCall(callControlId).catch(() => {});
    return;
  }

  // 3. Verificar saldo
  const saldoOk = await verificarSaldo(userId);
  if (!saldoOk) {
    logger.warn({ callControlId, userId }, "Llamada rechazada por saldo insuficiente");
    await hangupCall(callControlId).catch(() => {});
    return;
  }

  // 4. Verificar suspensión
  if (phone.user.isSuspended) {
    logger.warn({ callControlId, userId }, "Llamada rechazada - cuenta suspendida");
    await hangupCall(callControlId).catch(() => {});
    return;
  }

  // 5. Verificar horario de atención
  const settings = await db.businessSettings.findUnique({ where: { userId } });
  if (!settings) {
    logger.error({ callControlId, userId }, "Settings no encontradas");
    await hangupCall(callControlId).catch(() => {});
    return;
  }

  const dentroDeHorario = verificarHorario(settings);
  if (!dentroDeHorario && !settings.modo247) {
    logger.info({ callControlId, userId }, "Llamada fuera de horario");
    await hangupCall(callControlId).catch(() => {});
    return;
  }

  // 6. Contestar la llamada via Call Control API
  try {
    await answerCall(callControlId, clientState);
    logger.info({ callControlId, userId }, "Llamada contestada via Call Control API");
  } catch (e) {
    logger.error({ error: (e as Error).message, callControlId }, "Error contestando llamada");
    return;
  }

  // 7. Guardar contexto para cuando se confirme que se contestó
  pendingCalls.set(callControlId, { userId, dir: "inbound" });

  // 8. Registrar métrica de inicio de llamada
  await db.callMetric.create({
    data: {
      callSid: callControlId,
      userId,
      callerNumber: from ?? null,
      toNumber: to ?? null,
      inicio: new Date(),
    },
  }).catch(() => {});
}

/**
 * Maneja call.answered: inicia el streaming bidireccional de audio
 * hacia nuestro WebSocket donde Gemini procesará la conversación.
 */
async function handleCallAnswered(
  callControlId: string,
  clientState: string | undefined
): Promise<void> {
  // Recuperar contexto de la llamada
  let pending = pendingCalls.get(callControlId);

  // Si no está en el cache (p.ej. restart del servidor), intentar recuperar de la BD
  if (!pending) {
    const metric = await db.callMetric.findFirst({ where: { callSid: callControlId } });
    if (metric?.userId) {
      // Determinar dirección por client_state (las salientes siempre lo tienen)
      const dir = clientState ? "outbound" : "inbound";
      pending = { userId: metric.userId, dir };
    }
  }

  if (!pending) {
    // Última oportunidad: decodificar client_state
    if (clientState) {
      const decodificado = Buffer.from(clientState, "base64").toString("utf8");
      const userId = /^[0-9a-fA-F-]{36}$/.test(decodificado) ? decodificado : undefined;
      if (userId) {
        pending = { userId, dir: "outbound" };
      }
    }
  }

  if (!pending) {
    logger.warn({ callControlId }, "call.answered sin contexto de usuario - no se puede iniciar streaming");
    return;
  }

  const { userId, dir } = pending;

  // Construir URL del WebSocket de streaming
  const wsHost = process.env.DOMINIO_EXPRESS?.replace(/^https?:\/\//, "") || "localhost:3001";
  const dirParam = dir === "outbound" ? "&dir=outbound" : "";
  const streamUrl = `wss://${wsHost}/stream/telnyx?user_id=${encodeURIComponent(userId)}&call_control_id=${encodeURIComponent(callControlId)}${dirParam}`;

  // Iniciar streaming bidireccional via Call Control API
  try {
    await startStreaming({
      callControlId,
      streamUrl,
      clientState: userId,
    });
    logger.info({ callControlId, userId, streamUrl }, "Streaming bidireccional solicitado a Telnyx");
  } catch (e) {
    logger.error({ error: (e as Error).message, callControlId }, "Error iniciando streaming");
  }

  // Actualizar métrica con el momento real de contestación
  await db.callMetric.updateMany({
    where: { callSid: callControlId },
    data: { inicio: new Date() },
  }).catch(() => {});
}


/**
 * POST /webhooks/telnyx/call-control
 * Webhook de eventos Call Control (call.answered, call.hangup, etc.)
 */
const callControlSchema = z.object({
  event_type: z.string(),
  payload: z.object({
    call_control_id: z.string(),
    call_session_id: z.string().optional(),
    call_leg_id: z.string().optional(),
    client_state: z.string().optional(),
    recording_id: z.string().optional(),
    recording_url: z.string().optional(),
  }),
});

telnyxRouter.post("/call-control", validarFirmaTelnyx, async (req, res) => {
  const parsed = callControlSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, "Call Control webhook con datos inválidos");
    return res.status(200).send("OK");
  }

  const { event_type, payload } = parsed.data;
  const { call_control_id, recording_id, recording_url } = payload;

  logger.info({ event_type, call_control_id }, "Call Control event recibido");

  try {
    switch (event_type) {
      case "call.answered": {
        // Llamada contestada - actualizar métrica
        await db.callMetric.updateMany({
          where: { callSid: call_control_id },
          data: { inicio: new Date() },
        }).catch(() => {});
        break;
      }

      case "call.hangup": {
        // Llamada finalizada - debitar, grabar, métricas
        await handleCallHangup(call_control_id);
        break;
      }

      case "call.recording.saved": {
        // Grabación guardada
        if (recording_id && recording_url) {
          await handleRecordingSaved(call_control_id, recording_id, recording_url);
        }
        break;
      }

      case "call.initiated":
      case "call.ringing":
      case "call.bridged":
      case "call.unbridged":
      case "call.playback.started":
      case "call.playback.ended":
      case "call.gather.ended":
        // Eventos informativos, solo log
        logger.debug({ event_type, call_control_id }, "Evento Call Control");
        break;

      default:
        logger.info({ event_type }, "Evento Call Control no manejado");
    }
  } catch (e) {
    logger.error({ error: (e as Error).message, event_type, call_control_id }, "Error procesando Call Control");
  }

  res.status(200).send("OK");
});

async function handleCallHangup(callControlId: string): Promise<void> {
  try {
    const metric = await db.callMetric.findFirst({ where: { callSid: callControlId } });
    if (!metric || !metric.inicio || !metric.userId) {
      logger.warn({ callControlId }, "Métrica no encontrada o sin inicio/userId para hangup");
      return;
    }
    // Idempotencia: si la llamada ya se finalizó (p.ej. vía WebSocket), no volver a debitar/notificar
    if (metric.fin) {
      logger.warn({ callControlId }, "Llamada ya finalizada - omitiendo hangup duplicado");
      return;
    }

    const duracionSegundos = Math.round((Date.now() - metric.inicio.getTime()) / 1000);

    // 1. Debitar
    const { monto, saldoNuevo } = await (await import("../services/billing.service")).debitarLlamada(
      metric.userId,
      callControlId,
      duracionSegundos
    );

    // 2. Actualizar métrica
    await db.callMetric.update({
      where: { id: metric.id },
      data: {
        fin: new Date(),
        duracionSegundos,
        cobroAplicado: monto,
      },
    });

    // 3. Notificar al dueño via SSE
    const { emitirSSE } = await import("../sse/events.emitter");
    emitirSSE(metric.userId, "llamada_finalizada", {
      callSid: callControlId,
      duracionSegundos,
      costo: monto,
      saldoNuevo,
    });

    logger.info({ callControlId, duracionSegundos, monto, saldoNuevo }, "Llamada finalizada y debitada (Telnyx)");
  } catch (e) {
    logger.error({ error: (e as Error).message, callControlId }, "Error en hangup Telnyx");
  }
}

async function handleRecordingSaved(callControlId: string, recordingId: string, recordingUrl: string | null): Promise<void> {
  try {
    if (!recordingUrl) {
      logger.warn({ callControlId, recordingId }, "recordingUrl es null, no se guarda grabación");
      return;
    }
    const metric = await db.callMetric.findFirst({ where: { callSid: callControlId } });
    if (!metric || !metric.userId) return;

    await db.callRecording.create({
      data: {
        userId: metric.userId,
        telnyxCallControlId: callControlId,
        r2FileUrl: recordingUrl,
        durationSeconds: metric.duracionSegundos,
      },
    });

    logger.info({ callControlId, recordingId, recordingUrl }, "Grabación Telnyx registrada");
  } catch (e) {
    logger.error({ error: (e as Error).message, callControlId }, "Error guardando grabación Telnyx");
  }
}

function verificarHorario(settings: { businessHours: unknown; timezone: string }): boolean {
  try {
    const horario = settings.businessHours as Record<
      string,
      { abierto: boolean; inicio: string | null; fin: string | null }
    >;
    const ahora = new Date();
    const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const diaActual = dias[ahora.getDay()];
    const horarioHoy = horario[diaActual];
    if (!horarioHoy?.abierto) return false;

    const horaActual = ahora.getHours() * 100 + ahora.getMinutes();
    const inicio = parseInt((horarioHoy.inicio || "00:00").replace(":", ""));
    const fin = parseInt((horarioHoy.fin || "23:59").replace(":", ""));
    return horaActual >= inicio && horaActual <= fin;
  } catch {
    return true;
  }
}

function formatearHorarioTts(settings: { businessHours: unknown; aiLanguage: string }): string {
  try {
    const horario = settings.businessHours as Record<
      string,
      { abierto: boolean; inicio: string | null; fin: string | null }
    >;
    const dias: Record<string, string> = {
      lunes: "lunes",
      martes: "martes",
      miercoles: "miércoles",
      jueves: "jueves",
      viernes: "viernes",
      sabado: "sábados",
      domingo: "domingos",
    };
    const partes: string[] = [];
    for (const [key, label] of Object.entries(dias)) {
      const h = horario[key];
      if (h?.abierto) {
        partes.push(`${label} de ${h.inicio} a ${h.fin}`);
      }
    }
    return partes.join(", ");
  } catch {
    return "horario no disponible";
  }
}

function obtenerVozNeural(codigo: string): string {
  const voces: Record<string, string> = {
    es: "neural-es-ES",
    en: "neural-en-US",
    pt: "neural-pt-BR",
    fr: "neural-fr-FR",
    it: "neural-it-IT",
    de: "neural-de-DE",
  };
  return voces[codigo] ?? "neural-es-ES";
}