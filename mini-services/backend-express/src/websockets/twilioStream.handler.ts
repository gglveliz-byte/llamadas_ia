/**
 * Handler del WebSocket de Twilio <Connect><Stream>.
 * Cumple spec sección 7.2, 7.5, 7.7, 7.8.
 *
 * Pipeline bidireccional:
 *   Twilio → Express (inbound audio) → transcodificar → Gemini
 *   Gemini → Express (outbound audio) → transcodificar → Twilio
 *
 * Maneja:
 * - Eventos: start, media, stop
 * - Transcodificación μ-law ↔ PCM
 * - Barge-in (envío de "clear" a Twilio)
 * - Grabación (buffers en memoria)
 * - Billing al finalizar
 */
import type { WebSocket } from "ws";
import { crearSesionGemini, procesarMensajesGemini, ai } from "./gemini.handler";
import { transcodificarTwilioAGemini } from "../utils/audioTranscoder";
import { tieneVoz } from "../utils/audioTranscoder";
import { verificarSaldo, debitarLlamada } from "../services/billing.service";
import { incrementarLlamadasActivas, decrementarLlamadasActivas } from "../services/monitoring.service";
import { iniciarBufferLlamada, agregarChunkInbound, agregarChunkOutbound, ensamblarYSubirAudio } from "../services/audio.service";
import { emitirSSE } from "../sse/events.emitter";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";

interface StreamStartMessage {
  event: "start";
  start: {
    streamSid: string;
    callSid: string;
    accountSid: string;
    from: string;
    to: string;
    customParameters?: Record<string, string>;
  };
}

interface StreamMediaMessage {
  event: "media";
  media: {
    track: "inbound" | "outbound";
    chunk: number;
    timestamp: string;
    payload: string; // Base64 μ-law
  };
  streamSid: string;
}

interface StreamStopMessage {
  event: "stop";
  streamSid: string;
  callSid: string;
}

interface StreamDtmfMessage {
  event: "dtmf";
  dtmf: { digit: string; duration: string };
  streamSid: string;
}

type StreamMessage = StreamStartMessage | StreamMediaMessage | StreamStopMessage | StreamDtmfMessage;

interface SesionLlamada {
  callSid: string;
  streamSid: string;
  userId: string;
  inicio: number;
  sesionGemini: Awaited<ReturnType<typeof crearSesionGemini>> | null;
  ultimaActividadGemini: number;
  bargeInDetectado: boolean;
  grabacionActiva: boolean;
  settings: {
    aiLanguage: string;
    grabacionActiva: boolean;
  } | null;
}

const sesionesActivas = new Map<string, SesionLlamada>();

/**
 * Registra el handler en el WebSocket server.
 */
export function registrarTwilioStreamHandler(wss: import("ws").WebSocketServer): void {
  wss.on("connection", (ws: WebSocket, req: import("http").IncomingMessage) => {
    const url = new URL(req.url || "", "http://localhost");
    const userId = url.searchParams.get("user_id");
    const callSid = url.searchParams.get("call_sid");

    if (!userId || !callSid) {
      logger.error({ url: req.url }, "WebSocket sin user_id o call_sid");
      ws.close(1008, "Parámetros faltantes");
      return;
    }

    logger.info({ callSid, userId }, "WebSocket Twilio Stream conectado");
    incrementarLlamadasActivas();

    ws.on("message", async (data: Buffer) => {
      let mensaje: StreamMessage;
      try {
        mensaje = JSON.parse(data.toString()) as StreamMessage;
      } catch {
        logger.warn({ data: data.toString().slice(0, 200) }, "Mensaje WebSocket inválido");
        return;
      }

      switch (mensaje.event) {
        case "start":
          await manejarStart(ws, mensaje as StreamStartMessage, userId, callSid);
          break;
        case "media":
          await manejarMedia(ws, mensaje as StreamMediaMessage, callSid);
          break;
        case "stop":
          await manejarStop(mensaje as StreamStopMessage, callSid);
          break;
        case "dtmf":
          logger.info({ digit: (mensaje as StreamDtmfMessage).dtmf.digit, callSid }, "DTMF recibido");
          break;
      }
    });

    ws.on("close", async () => {
      logger.info({ callSid }, "WebSocket cerrado");
      decrementarLlamadasActivas();
      await finalizarLlamada(callSid);
    });

    ws.on("error", (error) => {
      logger.error({ error: error.message, callSid }, "Error en WebSocket Twilio");
      decrementarLlamadasActivas();
    });
  });
}

async function manejarStart(
  ws: WebSocket,
  mensaje: StreamStartMessage,
  userId: string,
  callSid: string
): Promise<void> {
  const streamSid = mensaje.start.streamSid;
  logger.info({ callSid, streamSid, from: mensaje.start.from, to: mensaje.start.to }, "Twilio Stream start");

  // Verificar saldo antes de iniciar
  const saldoOk = await verificarSaldo(userId);
  if (!saldoOk) {
    // Enviar TwiML de rechazo y cerrar
    logger.warn({ callSid, userId }, "Llamada rechazada por saldo insuficiente");
    ws.close(1011, "Saldo insuficiente");
    return;
  }

  // Cargar settings del negocio
  const settings = await db.businessSettings.findUnique({ where: { userId } });

  const sesion: SesionLlamada = {
    callSid,
    streamSid,
    userId,
    inicio: Date.now(),
    sesionGemini: null,
    ultimaActividadGemini: Date.now(),
    bargeInDetectado: false,
    grabacionActiva: settings?.grabacionActiva ?? false,
    settings: settings
      ? {
          aiLanguage: settings.aiLanguage,
          grabacionActiva: settings.grabacionActiva,
        }
      : null,
  };

  sesionesActivas.set(callSid, sesion);

  // Iniciar grabación si está activa
  if (settings?.grabacionActiva) {
    iniciarBufferLlamada(callSid);
  }

  // Crear sesión Gemini
  sesion.sesionGemini = await crearSesionGemini(userId, callSid, streamSid);

  if (sesion.sesionGemini) {
    // Iniciar loop de recepción de mensajes de Gemini
    procesarMensajesGemini(sesion.sesionGemini, userId, callSid, streamSid, (sid, audio) =>
      enviarATwilio(ws, sid, audio)
    );
  } else {
    // Sin Gemini API key - sesión simulada
    logger.warn({ callSid }, "Sesión Gemini simulada (sin API key)");
  }

  // Notificar al dueño
  emitirSSE(userId, "llamada_iniciada", { callSid, from: mensaje.start.from });
}

async function manejarMedia(
  ws: WebSocket,
  mensaje: StreamMediaMessage,
  callSid: string
): Promise<void> {
  const sesion = sesionesActivas.get(callSid);
  if (!sesion) return;

  const payload = mensaje.media.payload;
  const track = mensaje.media.track;

  // Buffer para grabación
  if (track === "inbound" && sesion.grabacionActiva) {
    agregarChunkInbound(callSid, Buffer.from(payload, "base64"));
  } else if (track === "outbound" && sesion.grabacionActiva) {
    agregarChunkOutbound(callSid, Buffer.from(payload, "base64"));
  }

  // Solo procesar inbound con Gemini
  if (track !== "inbound" || !sesion.sesionGemini) return;

  // Transcodificar Twilio → Gemini (μ-law 8k → PCM 16k)
  const pcm16k = transcodificarTwilioAGemini(payload);

  // Enviar a Gemini como input en tiempo real
  try {
    await sesion.sesionGemini.sendRealtimeInput({
      audio: {
        data: pcm16k.toString("base64"),
        mimeType: "audio/pcm;rate=16000",
      },
    });
    sesion.ultimaActividadGemini = Date.now();
  } catch (e) {
    logger.error({ error: (e as Error).message, callSid }, "Error enviando audio a Gemini");
  }

  // Detección de barge-in (spec 7.5)
  // Si el usuario habla mientras Gemini genera audio, enviar "clear" a Twilio
  if (tieneVoz(payload, -40)) {
    const tiempoDesdeUltimaActividad = Date.now() - sesion.ultimaActividadGemini;
    if (tiempoDesdeUltimaActividad > 200 && !sesion.bargeInDetectado) {
      // Posible barge-in - limpiar buffer de Twilio
      sesion.bargeInDetectado = true;
      enviarClearATwilio(ws, sesion.streamSid);
      setTimeout(() => (sesion.bargeInDetectado = false), 1000);
    }
  }
}

async function manejarStop(mensaje: StreamStopMessage, callSid: string): Promise<void> {
  logger.info({ callSid }, "Twilio Stream stop");
  await finalizarLlamada(callSid);
}

async function finalizarLlamada(callSid: string): Promise<void> {
  const sesion = sesionesActivas.get(callSid);
  if (!sesion) return;

  const duracionSegundos = Math.round((Date.now() - sesion.inicio) / 1000);

  try {
    // 1. Debitar
    const { monto, saldoNuevo } = await debitarLlamada(sesion.userId, callSid, duracionSegundos);

    // 2. Grabación
    if (sesion.grabacionActiva) {
      await ensamblarYSubirAudio(callSid, sesion.userId);
    }

    // 3. Métricas
    await db.callMetric.create({
      data: {
        callSid,
        userId: sesion.userId,
        inicio: new Date(sesion.inicio),
        fin: new Date(),
        duracionSegundos,
        cobroAplicado: monto,
      },
    });

    // 4. Cerrar sesión Gemini
    if (sesion.sesionGemini) {
      try {
        await sesion.sesionGemini.close();
      } catch {}
    }

    // 5. Notificar al dueño via SSE
    emitirSSE(sesion.userId, "llamada_finalizada", {
      callSid,
      duracionSegundos,
      costo: monto,
      saldoNuevo,
    });

    logger.info(
      { callSid, duracionSegundos, monto, saldoNuevo },
      "Llamada finalizada y debitada"
    );
  } catch (e) {
    logger.error({ error: (e as Error).message, callSid }, "Error finalizando llamada");
  } finally {
    sesionesActivas.delete(callSid);
  }
}

// Helpers para enviar mensajes a Twilio
function enviarATwilio(ws: WebSocket, streamSid: string, audioBase64: string): void {
  const msg = {
    event: "media",
    streamSid,
    media: { payload: audioBase64 },
  };
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function enviarClearATwilio(ws: WebSocket, streamSid: string): void {
  const msg = {
    event: "clear",
    streamSid,
  };
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
    logger.debug({ streamSid }, "Clear enviado a Twilio (barge-in)");
  }
}

export function obtenerLlamadasActivas(): number {
  return sesionesActivas.size;
}
