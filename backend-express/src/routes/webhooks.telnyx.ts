/**
 * Webhooks de Telnyx - Voz entrante y eventos Call Control.
 * Cumple spec sección 7.1 adaptada a Telnyx Call Control API.
 */
import { Router } from "express";
import { z } from "zod";
import { db } from "../models/database.pool";
import { validarFirmaTelnyx } from "../middleware/telnyxSignature";
import { verificarSaldo } from "../services/billing.service";
import {
  answerCall,
  hangupCall,
  startStreaming,
  speakText,
} from "../services/telnyx.service";
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
    recording_id: z.string().optional(),
    recording_url: z.string().optional(),
  }),
});

export const telnyxRouter = Router();

/**
 * POST /webhooks/telnyx/voice
 * Webhook unificado para eventos de Telnyx Call Control.
 * Maneja call.initiated, call.answered, call.hangup, etc.
 */
telnyxRouter.post("/voice", validarFirmaTelnyx, async (req, res) => {
  const parsed = telnyxVoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, "Webhook Telnyx con datos inválidos");
    return res.status(200).send("OK");
  }

  const { event_type, payload } = parsed.data;
  const { call_control_id, from, to, direction, client_state, recording_id, recording_url } = payload;

  logger.info({ event_type, call_control_id, from, to, direction }, `[WEBHOOK TELNYX] ---> EVENTO: ${event_type}`);

  // Respondemos 200 inmediatamente para que Telnyx no reintente
  res.status(200).send("OK");

  // Procesamos en background
  (async () => {
    try {
      if (event_type === "call.initiated" && direction === "outgoing") {
        logger.info(`[WEBHOOK TELNYX] 📞 Llamada saliente iniciada hacia ${to}. Esperando a que contesten...`);
        // Las llamadas salientes se inician con createOutboundCall.
        // El streaming se inicia al recibir call.answered.
        return;
      }

      if (event_type === "call.initiated" && direction === "incoming") {
        logger.info(`[WEBHOOK TELNYX] 📞 Llamada entrante detectada desde ${from} hacia ${to}. Verificando configuración...`);
        // Buscar usuario por número destino (to)
        const phone = await db.phoneNumber.findFirst({
          where: { phoneNumber: to, isActive: true },
          include: { user: true },
        });

        if (!phone?.user) {
          logger.warn({ to }, "[WEBHOOK TELNYX] ❌ Rechazo: Número no asignado a ningún usuario activo.");
          await answerCall(call_control_id);
          await speakText(call_control_id, "Lo sentimos, este número no está configurado.");
          setTimeout(() => hangupCall(call_control_id).catch(() => {}), 8000);
          return;
        }

        const userId = phone.user.id;
        logger.info(`[WEBHOOK TELNYX] ✅ Número pertenece al usuario: ${userId}.`);

        // 1. Verificar mantenimiento global
        const mantenimiento = await db.adminConfig.findUnique({
          where: { clave: "mensaje_mantenimiento" },
        });
        if (mantenimiento?.valor) {
          await answerCall(call_control_id);
          await speakText(call_control_id, mantenimiento.valor);
          setTimeout(() => hangupCall(call_control_id).catch(() => {}), 8000);
          return;
        }

        // 2. Verificar saldo
        const saldoOk = await verificarSaldo(userId);
        if (!saldoOk) {
          await answerCall(call_control_id);
          await speakText(call_control_id, "Lo sentimos, este servicio no está disponible temporalmente.");
          setTimeout(() => hangupCall(call_control_id).catch(() => {}), 8000);
          return;
        }

        // 3. Verificar suspención
        if (phone.user.isSuspended) {
          await answerCall(call_control_id);
          await speakText(call_control_id, "Esta cuenta está suspendida.");
          setTimeout(() => hangupCall(call_control_id).catch(() => {}), 8000);
          return;
        }

        // 4. Verificar horario de atención
        const settings = await db.businessSettings.findUnique({ where: { userId } });
        if (!settings) {
          await answerCall(call_control_id);
          await speakText(call_control_id, "Configuración no encontrada.");
          setTimeout(() => hangupCall(call_control_id).catch(() => {}), 8000);
          return;
        }

        const dentroDeHorario = verificarHorario(settings);
        if (!dentroDeHorario && !settings.modo247) {
          const horarioTexto = formatearHorarioTts(settings);
          await answerCall(call_control_id);
          await speakText(
            call_control_id,
            `Gracias por llamar. Nuestro horario de atención es ${horarioTexto}.`,
            obtenerIdioma(settings.aiLanguage),
            obtenerVoz(settings.aiLanguage)
          );
          setTimeout(() => hangupCall(call_control_id).catch(() => {}), 15000);
          return;
        }

        // 5. Todo OK - Contestar e Iniciar Streaming
        logger.info(`[WEBHOOK TELNYX] 🟢 Todo OK. Contestando llamada entrante e iniciando streaming...`);
        // Pasamos el client_state como JSON con el userId y dirección para identificarlo después si fuera necesario
        const clientStateObj = JSON.stringify({ userId, dir: "inbound" });
        const b64State = Buffer.from(clientStateObj).toString("base64");
        
        await answerCall(call_control_id, b64State);

        const wsHost = process.env.DOMINIO_EXPRESS?.replace(/^https?:\/\//, "") || "localhost:3001";
        const streamUrl = `wss://${wsHost}/stream/telnyx?user_id=${userId}&call_control_id=${call_control_id}&dir=inbound`;

        await startStreaming(call_control_id, streamUrl, b64State);

        logger.info({ call_control_id, userId, streamUrl }, "[WEBHOOK TELNYX] 🔗 Solicitud de WebSocket (streaming_start) enviada a Telnyx.");

        // 6. Registrar métrica
        await db.callMetric.create({
          data: {
            callSid: call_control_id,
            userId,
            callerNumber: from ?? null,
            toNumber: to ?? null,
            inicio: new Date(),
          },
        }).catch(() => {});
        return; // Fin de call.initiated incoming
      }

      // Para otros eventos: call.answered, call.hangup, etc.
      switch (event_type) {
        case "call.answered": {
          logger.info(`[WEBHOOK TELNYX] 🗣️ El destino contestó la llamada. Evaluando inicio de stream...`);
          // Llamada contestada - actualizar métrica
          await db.callMetric.updateMany({
            where: { callSid: call_control_id },
            data: { inicio: new Date() },
          }).catch(() => {});

          // Si es llamada saliente, iniciamos streaming cuando el cliente contesta
          if (client_state) {
            const decodificado = Buffer.from(client_state, "base64").toString("utf8");
            logger.info(`[WEBHOOK TELNYX] Estado del cliente (client_state) decodificado: ${decodificado}`);
            try {
              const stateObj = JSON.parse(decodificado);
              if (stateObj.dir === "outbound") {
                const wsHost = process.env.DOMINIO_EXPRESS?.replace(/^https?:\/\//, "") || "localhost:3001";
                const streamUrl = `wss://${wsHost}/stream/telnyx?user_id=${stateObj.userId}&call_control_id=${call_control_id}&dir=outbound`;
                
                logger.info(`[WEBHOOK TELNYX] 🚀 Iniciando streaming para llamada saliente hacia URL: ${streamUrl}`);
                await startStreaming(call_control_id, streamUrl, client_state);
                logger.info({ call_control_id, userId: stateObj.userId }, "[WEBHOOK TELNYX] 🔗 Solicitud de WebSocket enviada con éxito.");
              } else {
                logger.info(`[WEBHOOK TELNYX] La llamada es inbound, el streaming ya fue solicitado en call.initiated.`);
              }
            } catch {
              logger.warn("[WEBHOOK TELNYX] El client_state no es JSON válido.");
            }
          } else {
            logger.warn("[WEBHOOK TELNYX] No se recibió client_state en el evento call.answered.");
          }
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

        case "call.ringing":
        case "call.bridged":
        case "call.unbridged":
        case "call.playback.started":
        case "call.playback.ended":
        case "call.gather.ended":
          // Eventos informativos, solo log
          logger.debug({ event_type, call_control_id }, "Evento Call Control informativo");
          break;
      }
    } catch (e) {
      logger.error({ error: (e as Error).message, event_type, call_control_id }, "Error procesando Call Control en background");
    }
  })();
});

/**
 * POST /webhooks/telnyx/call-control
 * Alias por compatibilidad.
 */
telnyxRouter.post("/call-control", validarFirmaTelnyx, (req, res) => {
  // Redirigir internamente al mismo manejador enviando una redirección 307
  // O simplemente re-invocar la lógica copiando. Aquí usaremos un redirect 307
  res.redirect(307, "/webhooks/telnyx/voice");
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

function obtenerIdioma(codigo: string): string {
  const mapeo: Record<string, string> = {
    es: "es-ES",
    en: "en-US",
    pt: "pt-BR",
    fr: "fr-FR",
    it: "it-IT",
    de: "de-DE",
  };
  return mapeo[codigo] ?? "es-ES";
}

function obtenerVoz(codigo: string): string {
  // En Telnyx speak, la voz puede ser "female" o "male" para los idiomas estándar
  return "female";
}