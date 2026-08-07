/**
 * Webhooks de Telnyx - Voz entrante.
 * Cumple spec sección 7.1 adaptada a Telnyx TeXML.
 * 
 * POST /webhooks/telnyx/voice
 * Recibe call.initiated, genera TeXML con <Dial><Stream> para conectar a Gemini.
 */
import { Router } from "express";
import { z } from "zod";
import { db } from "../models/database.pool";
import { validarFirmaTelnyx } from "../middleware/telnyxSignature";
import { verificarSaldo } from "../services/billing.service";
import { generateInboundTeXML, generateRejectionTeXML } from "../services/telnyx.service";
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
 * POST /webhooks/telnyx/voice
 * Webhook de llamada entrante (call.initiated).
 * Valida firma, verifica saldo/horario, responde con TeXML <Dial><Stream>.
 */
telnyxRouter.post("/voice", validarFirmaTelnyx, async (req, res) => {
  const parsed = telnyxVoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, "Webhook Telnyx con datos inválidos");
    return res.type("application/xml").send(
      generateRejectionTeXML("Error de configuración.")
    );
  }

  const { event_type, payload } = parsed.data;
  const { call_control_id, from, to, direction, client_state } = payload;

  logger.info({ event_type, call_control_id, from, to, direction }, "Webhook Telnyx voz recibido");

  // Llamadas salientes: el dueño las inicia desde el panel; conectamos el
  // stream de la IA con dir=outbound para el saludo/prompt saliente.
  if (event_type === "call.initiated" && direction === "outgoing") {
    // client_state viaja en base64 (requisito de Telnyx): decodificar a userId
    let userId: string | undefined;
    if (client_state) {
      const decodificado = Buffer.from(client_state, "base64").toString("utf8");
      userId = /^[0-9a-fA-F-]{36}$/.test(decodificado) ? decodificado : client_state;
    }
    if (!userId) {
      logger.warn({ call_control_id }, "Llamada saliente sin client_state");
      return res.status(200).send("OK");
    }

    const saldoOk = await verificarSaldo(userId);
    if (!saldoOk) {
      return res.type("application/xml").send(
        generateRejectionTeXML("Lo sentimos, saldo insuficiente para completar la llamada.")
      );
    }

    const wsHost = process.env.DOMINIO_EXPRESS?.replace(/^https?:\/\//, "") || "localhost:3001";
    const streamUrl = `wss://${wsHost}/stream/telnyx`;
    const texml = generateInboundTeXML({
      streamUrl,
      callControlId: call_control_id,
      userId,
      dir: "outbound",
    });

    logger.info({ call_control_id, userId }, "TeXML saliente generado - conectando stream");
    return res.type("application/xml").send(texml);
  }

  // Solo procesamos llamadas entrantes
  if (event_type !== "call.initiated" || direction !== "incoming") {
    logger.info({ event_type, direction }, "Evento no procesado (no es call.initiated incoming)");
    return res.status(200).send("OK");
  }

  // Buscar usuario por número destino (to)
  const phone = await db.phoneNumber.findFirst({
    where: { phoneNumber: to, isActive: true },
    include: { user: true },
  });

  if (!phone?.user) {
    logger.warn({ to }, "Número no registrado en Telnyx");
    return res.type("application/xml").send(
      generateRejectionTeXML("Lo sentimos, este número no está configurado.")
    );
  }

  const userId = phone.user.id;

  // 1. Verificar mantenimiento global
  const mantenimiento = await db.adminConfig.findUnique({
    where: { clave: "mensaje_mantenimiento" },
  });
  if (mantenimiento?.valor) {
    return res.type("application/xml").send(
      generateRejectionTeXML(mantenimiento.valor)
    );
  }

  // 2. Verificar saldo
  const saldoOk = await verificarSaldo(userId);
  if (!saldoOk) {
    return res.type("application/xml").send(
      generateRejectionTeXML("Lo sentimos, este servicio no está disponible temporalmente.")
    );
  }

  // 3. Verificar suspención
  if (phone.user.isSuspended) {
    return res.type("application/xml").send(
      generateRejectionTeXML("Esta cuenta está suspendida.")
    );
  }

  // 4. Verificar horario de atención
  const settings = await db.businessSettings.findUnique({ where: { userId } });
  if (!settings) {
    return res.type("application/xml").send(
      generateRejectionTeXML("Configuración no encontrada.")
    );
  }

  const dentroDeHorario = verificarHorario(settings);
  if (!dentroDeHorario && !settings.modo247) {
    const horarioTexto = formatearHorarioTts(settings);
    return res.type("application/xml").send(
      generateRejectionTeXML(`Gracias por llamar. Nuestro horario de atención es ${horarioTexto}.`, settings.aiLanguage)
    );
  }

  // 5. Construir URL de WebSocket streaming
  const wsHost = process.env.DOMINIO_EXPRESS?.replace(/^https?:\/\//, "") || "localhost:3001";
  const streamUrl = `wss://${wsHost}/stream/telnyx`;

  // 6. Mensaje de consentimiento si está activo
  const consentMessage = settings.consentimientoActivo && settings.mensajeConsentimiento
    ? settings.mensajeConsentimiento
    : undefined;

  // 7. Generar TeXML con <Dial><Stream>
  const texml = generateInboundTeXML({
    streamUrl,
    callControlId: call_control_id,
    userId,
    language: settings.aiLanguage,
    voice: obtenerVozNeural(settings.aiLanguage),
    consentMessage,
  });

  logger.info({ call_control_id, userId, streamUrl }, "TeXML generado - conectando stream");

  // 8. Registrar métrica de inicio de llamada (con el origen para el historial)
  await db.callMetric.create({
    data: {
      callSid: call_control_id,
      userId,
      callerNumber: from ?? null,
      toNumber: to ?? null,
      inicio: new Date(),
    },
  }).catch(() => {});

  return res.type("application/xml").send(texml);
});

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