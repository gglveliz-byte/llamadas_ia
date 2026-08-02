/**
 * Handler del WebSocket de Telnyx Media Streaming.
 * Conecta Telnyx <Dial><Stream> con tu pipeline Gemini Live existente.
 * 
 * Eventos Telnyx: start, media, stop, dtmf
 * Formato audio: μ-law 8kHz Base64 (estándar telefonía PCMU)
 * 
 * Reutiliza: crearSesionGemini, procesarMensajesGemini, transcodificarTelefoníaAGemini, etc.
 */
import fs from "fs";
import path from "path";
import type { WebSocket } from "ws";
import g711 from "g711";
import { crearSesionGemini, procesarMensajesGemini } from "./gemini.handler";
const MODELO = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
import { transcodificarTelefoníaAGemini, transcodificarGeminiATelefonía } from "../utils/audioTranscoder";
import { hangupCall } from "../services/telnyx.service";
import { crearDetectorVoz, type DetectorVoz } from "../services/vad.service";
import { verificarSaldo, debitarLlamada } from "../services/billing.service";
import { incrementarLlamadasActivas, decrementarLlamadasActivas } from "../services/monitoring.service";
import { incrementarConcurrenciaTelnyx, decrementarConcurrenciaTelnyx } from "../services/ratelimit.service";
import { iniciarBufferLlamada, agregarChunkInbound, agregarChunkOutbound, ensamblarYSubirAudio } from "../services/audio.service";
import { emitirSSE } from "../sse/events.emitter";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";

interface StreamStartMessage {
  event: "start";
  start: {
    stream_id: string;
    call_control_id: string;
    call_session_id: string;
    custom_headers?: Record<string, string>;
    from: string;
    to: string;
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
  stream_id: string;
}

interface StreamStopMessage {
  event: "stop";
  stream_id: string;
  call_control_id: string;
}

interface StreamDtmfMessage {
  event: "dtmf";
  dtmf: { digit: string; duration: string };
  stream_id: string;
}

type StreamMessage = StreamStartMessage | StreamMediaMessage | StreamStopMessage | StreamDtmfMessage;

interface TranscriptLinea {
  texto: string;
  rol: string;
  ts: number;
}

interface SesionLlamada {
  callControlId: string;
  streamId: string;
  userId: string;
  inicio: number;
  sesionGemini: Awaited<ReturnType<typeof crearSesionGemini>> | null;
  detectorVoz: DetectorVoz | null;
  ultimaActividadGemini: number;
  ultimoVozDetectada: number;
  bargeInDetectado: boolean;
  grabacionActiva: boolean;
  finalizada: boolean;
  transcripts: TranscriptLinea[];
  settings: {
    aiLanguage: string;
    grabacionActiva: boolean;
  } | null;
}

const sesionesActivas = new Map<string, SesionLlamada>();

/**
 * Registra el handler en el WebSocket server.
 * Endpoint: wss://{host}/stream/telnyx?user_id=...&call_control_id=...
 */
export function registrarTelnyxStreamHandler(wss: import("ws").WebSocketServer): void {
  wss.on("connection", async (ws: WebSocket, req: import("http").IncomingMessage) => {
    const url = new URL(req.url || "", "http://localhost");
    const userId = url.searchParams.get("user_id");
    const callControlId = url.searchParams.get("call_control_id");

    if (!userId || !callControlId) {
      logger.error({ url: req.url }, "WebSocket Telnyx sin user_id o call_control_id");
      ws.close(1008, "Parámetros faltantes");
      return;
    }

    logger.info({ callControlId, userId }, "WebSocket Telnyx Stream conectado");
    incrementarLlamadasActivas();
    await incrementarConcurrenciaTelnyx();

    // Verificar saldo antes de iniciar
    const saldoOk = await verificarSaldo(userId);
    if (!saldoOk) {
      logger.warn({ callControlId, userId }, "Llamada rechazada por saldo insuficiente");
      ws.close(1011, "Saldo insuficiente");
      return;
    }

    // Cargar settings del negocio
    const settings = await db.businessSettings.findUnique({ where: { userId } });

    const sesion: SesionLlamada = {
      callControlId,
      streamId: "", // se llena en start
      userId,
      inicio: Date.now(),
      sesionGemini: null,
      detectorVoz: null,
      ultimaActividadGemini: Date.now(),
      ultimoVozDetectada: 0,
      bargeInDetectado: false,
      grabacionActiva: settings?.grabacionActiva ?? false,
      finalizada: false,
      transcripts: [],
      settings: settings
        ? {
            aiLanguage: settings.aiLanguage,
            grabacionActiva: settings.grabacionActiva,
          }
        : null,
    };

    ws.on("message", async (data: Buffer) => {
      let mensaje: StreamMessage;
      try {
        mensaje = JSON.parse(data.toString()) as StreamMessage;
      } catch {
        logger.warn({ data: data.toString().slice(0, 200) }, "Mensaje WebSocket Telnyx inválido");
        return;
      }

      switch (mensaje.event) {
        case "start":
          try {
            await manejarStart(ws, mensaje as StreamStartMessage, userId, callControlId, sesion);
          } catch (e) {
            logger.error({ error: (e as Error).message, callControlId }, "Error iniciando llamada Telnyx");
          }
          break;
        case "media":
          await manejarMedia(ws, mensaje as StreamMediaMessage, callControlId, sesion);
          break;
        case "stop":
          await manejarStop(mensaje as StreamStopMessage, callControlId, sesion);
          break;
        case "dtmf":
          logger.info({ digit: (mensaje as StreamDtmfMessage).dtmf.digit, callControlId }, "DTMF Telnyx recibido");
          break;
      }
    });

    ws.on("close", async () => {
      logger.info({ callControlId }, "WebSocket Telnyx cerrado");
      decrementarLlamadasActivas();
      await decrementarConcurrenciaTelnyx();
      await finalizarLlamada(callControlId, sesion);
    });

    ws.on("error", (error) => {
      logger.error({ error: error.message, callControlId }, "Error en WebSocket Telnyx");
      decrementarLlamadasActivas();
      decrementarConcurrenciaTelnyx().catch(() => {});
    });
  });
}

async function manejarStart(
  ws: WebSocket,
  mensaje: StreamStartMessage,
  userId: string,
  callControlId: string,
  sesion: SesionLlamada
): Promise<void> {
  const streamId = mensaje.start.stream_id;
  sesion.streamId = streamId;

  logger.info({ callControlId, streamId, from: mensaje.start.from, to: mensaje.start.to }, "Telnyx Stream start");

  // Cargar settings del negocio (si no se cargó antes)
  if (!sesion.settings) {
    const settings = await db.businessSettings.findUnique({ where: { userId } });
    sesion.settings = settings
      ? {
          aiLanguage: settings.aiLanguage,
          grabacionActiva: settings.grabacionActiva,
        }
      : null;
    sesion.grabacionActiva = settings?.grabacionActiva ?? false;
  }

  // Iniciar grabación si está activa
  if (sesion.grabacionActiva) {
    iniciarBufferLlamada(callControlId);
  }

  // Crear sesión Gemini
  try {
    sesion.sesionGemini = await crearSesionGemini(userId, callControlId, streamId);
  } catch (e) {
    logger.error({ error: (e as Error).message, callControlId }, "Error creando sesión Gemini");
  }

  if (sesion.sesionGemini) {
    // Iniciar loop de recepción de mensajes de Gemini
    procesarMensajesGemini(
      sesion.sesionGemini,
      userId,
      callControlId,
      streamId,
      (sid, audio) => enviarATelnyx(ws, sid, audio),
      (texto, rol, ts) => sesion.transcripts.push({ texto, rol, ts })
    ).catch((e) => {
      logger.error({ error: (e as Error).message, callControlId }, "Error en loop de Gemini");
    });
  } else {
    logger.warn({ callControlId }, "Sesión Gemini no disponible - ejecutando Fallback de Audio");
    try {
      const fallbackPath = path.join(__dirname, "../../assets/fallback_audio.txt");
      if (fs.existsSync(fallbackPath)) {
        const audioBase64 = fs.readFileSync(fallbackPath, "utf8");
        enviarATelnyx(ws, streamId, audioBase64);
      }
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Error leyendo fallback audio");
    }
    // Cerrar el websocket para colgar o avanzar
    setTimeout(() => {
      ws.close(1011, "Gemini Unavailable");
      hangupCall(callControlId).catch(e => logger.error({ error: (e as Error).message }, "Error colgando llamada tras fallback"));
    }, 9500); // Dar tiempo a que se reproduzca el mensaje (10s)
  }

  // Detector de voz (WebRTC VAD) para barge-in preciso
  sesion.detectorVoz = await crearDetectorVoz(8000, 1);

  // Notificar al dueño
  emitirSSE(userId, "llamada_iniciada", { callSid: callControlId, from: mensaje.start.from });
}

async function manejarMedia(
  ws: WebSocket,
  mensaje: StreamMediaMessage,
  callControlId: string,
  sesion: SesionLlamada
): Promise<void> {
  if (!sesion) return;

  const payload = mensaje.media.payload;
  const track = mensaje.media.track;

  // Buffer para grabación
  if (track === "inbound" && sesion.grabacionActiva) {
    agregarChunkInbound(callControlId, Buffer.from(payload, "base64"));
  } else if (track === "outbound" && sesion.grabacionActiva) {
    agregarChunkOutbound(callControlId, Buffer.from(payload, "base64"));
  }

  // Solo procesar inbound con Gemini
  if (track !== "inbound" || !sesion.sesionGemini) return;

  // Detección de barge-in y Voice Activity (WebRTC VAD - ML, distingue voz de ruido)
  const mulawBuf = Buffer.from(payload, "base64");
  const pcmSamples = g711.ulawToPCM(mulawBuf);
  const pcmBuf = Buffer.from(pcmSamples.buffer, pcmSamples.byteOffset, pcmSamples.byteLength);
  
  if (sesion.detectorVoz?.tieneVoz(pcmBuf)) {
    sesion.ultimoVozDetectada = Date.now();
    const tiempoDesdeUltimaActividad = Date.now() - sesion.ultimaActividadGemini;
    if (tiempoDesdeUltimaActividad > 200 && !sesion.bargeInDetectado) {
      // Posible barge-in - limpiar buffer de Telnyx
      sesion.bargeInDetectado = true;
      enviarClearATelnyx(ws, sesion.streamId);
      setTimeout(() => (sesion.bargeInDetectado = false), 1000);
    }
  }

  // Filtro VAD: Si no hubo voz en los últimos 500ms, descartar ruido de fondo
  if (Date.now() - sesion.ultimoVozDetectada > 500) {
    return;
  }

  // Transcodificar Telnyx (μ-law 8k) → Gemini (PCM 16k)
  const pcm16k = await transcodificarTelefoníaAGemini(payload);

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
    logger.error({ error: (e as Error).message, callControlId }, "Error enviando audio a Gemini");
  }
}

async function manejarStop(mensaje: StreamStopMessage, callControlId: string, sesion: SesionLlamada): Promise<void> {
  logger.info({ callControlId }, "Telnyx Stream stop");
  await finalizarLlamada(callControlId, sesion);
}

async function finalizarLlamada(callControlId: string, sesion: SesionLlamada): Promise<void> {
  if (sesion.finalizada) return;
  sesion.finalizada = true;

  const duracionSegundos = Math.round((Date.now() - sesion.inicio) / 1000);

  try {
    // 1. Debitar
    const { monto, saldoNuevo } = await debitarLlamada(sesion.userId, callControlId, duracionSegundos);

    // 2. Grabación
    if (sesion.grabacionActiva) {
      await ensamblarYSubirAudio(callControlId, sesion.userId);
    }

    // 3. Métricas
    await db.callMetric.updateMany({
      where: { callSid: callControlId },
      data: {
        fin: new Date(),
        duracionSegundos,
        cobroAplicado: monto,
      },
    });

    // 4. Persistir transcript de la llamada (solo IA por ahora - sin STT usuario)
    if (sesion.transcripts.length > 0) {
      await db.callTranscript.createMany({
        data: sesion.transcripts.map((t) => ({
          callSid: callControlId,
          userId: sesion.userId,
          rol: t.rol,
          texto: t.texto,
          ts: new Date(t.ts),
        })),
      });
    }

    // 5. Cerrar sesión Gemini
    if (sesion.sesionGemini) {
      try {
        await sesion.sesionGemini.close();
      } catch {}
    }

    // 6. Notificar al dueño via SSE
    emitirSSE(sesion.userId, "llamada_finalizada", {
      callSid: callControlId,
      duracionSegundos,
      costo: monto,
      saldoNuevo,
    });

    logger.info(
      { callControlId, duracionSegundos, monto, saldoNuevo },
      "Llamada Telnyx finalizada y debitada"
    );
  } catch (e) {
    logger.error({ error: (e as Error).message, callControlId }, "Error finalizando llamada Telnyx");
  } finally {
    sesion.detectorVoz?.liberar();
    sesion.detectorVoz = null;
    sesionesActivas.delete(callControlId);
  }
}

// Helpers para enviar mensajes a Telnyx
function enviarATelnyx(ws: WebSocket, streamId: string, audioBase64: string): void {
  const msg = {
    event: "media",
    stream_id: streamId,
    media: { payload: audioBase64 },
  };
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function enviarClearATelnyx(ws: WebSocket, streamId: string): void {
  // Telnyx no tiene evento "clear" nativo, enviamos media vacía o usamos fork_stop
  // Como workaround, enviamos media vacía para limpiar buffer
  const msg = {
    event: "media",
    stream_id: streamId,
    media: { payload: "" },
  };
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
    logger.debug({ streamId }, "Clear enviado a Telnyx (barge-in workaround)");
  }
}

export function obtenerLlamadasActivasTelnyx(): number {
  return sesionesActivas.size;
}