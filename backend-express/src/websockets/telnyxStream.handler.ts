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
const MODELO = process.env.GEMINI_MODEL || "models/gemini-3.1-flash-live-preview";
import { transcodificarTelefoníaAGemini, transcodificarGeminiATelefonía } from "../utils/audioTranscoder";
import { hangupCall } from "../services/telnyx.service";
import { crearSileroVAD, VADAccumulator, BargeInGuard, vadConfigManager } from "../services/vad.service";
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

interface StreamConnectedMessage {
  event: "connected";
  version?: string;
}

type StreamMessage = StreamStartMessage | StreamMediaMessage | StreamStopMessage | StreamDtmfMessage | StreamConnectedMessage;

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
  detectorVoz: VADAccumulator | null;
  guard: BargeInGuard | null;
  vadBase: number;
  vadBoost: number;
  ultimaActividadGemini: number;
  isSpeaking: boolean;
  bargeInDetectado: boolean;
  grabacionActiva: boolean;
  finalizada: boolean;
  transcripts: Array<{ texto: string; rol: string; ts: number }>;
  settings: {
    aiLanguage: string;
    grabacionActiva: boolean;
  } | null;
  alertaMediaSinGemini?: boolean;
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
    const esOutbound = url.searchParams.get("dir") === "outbound";

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
      streamId: "", // se llena en start o connected
      userId,
      inicio: Date.now(),
      sesionGemini: null,
      detectorVoz: null,
      guard: null,
      vadBase: 0.62,
      vadBoost: 0.15,
      ultimaActividadGemini: Date.now(),
      isSpeaking: false,
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
        case "connected":
        case "start":
          try {
            if (!sesion.streamId) {
              // Set immediately to prevent race conditions with incoming concurrent 'start' event
              sesion.streamId = (mensaje as any)?.start?.stream_id || callControlId;
              logger.info(`[STREAM TELNYX] 🔗 Recibido evento '${mensaje.event}'. Iniciando conexión con Gemini para la llamada...`);
              await manejarStart(ws, userId, callControlId, sesion, esOutbound, mensaje);
            } else {
              logger.info(`[STREAM TELNYX] 🔗 Recibido evento '${mensaje.event}' pero Gemini ya estaba inicializado. Ignorando.`);
            }
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
        default:
          logger.warn({ event: (mensaje as any).event, dataPreview: data.toString().slice(0, 100) }, "Evento WebSocket Telnyx desconocido/ignorado");
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
  userId: string,
  callControlId: string,
  sesion: SesionLlamada,
  esOutbound = false,
  mensaje?: any
): Promise<void> {
  // Para TeXML es start.stream_id, para Call Control no hay streamId.
  const streamId = mensaje?.start?.stream_id || callControlId;
  sesion.streamId = streamId;

  const metric = await db.callMetric.findFirst({ where: { callSid: callControlId }});
  const from = mensaje?.start?.from || metric?.callerNumber || "desconocido";
  const to = mensaje?.start?.to || metric?.toNumber || "desconocido";

  logger.info({ callControlId, streamId, from, to }, `[STREAM TELNYX] 🚀 Evento 'start' / 'connected' procesado. streamId asignado: ${streamId}`);

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

  // Crear sesión Gemini (modo saliente si la llamada la inició el dueño)
  try {
    sesion.sesionGemini = await crearSesionGemini(
      userId,
      callControlId,
      streamId,
      esOutbound ? "outbound" : "inbound"
    );
  } catch (e) {
    logger.error({ error: (e as Error).message, callControlId }, "Error creando sesión Gemini");
  }

  if (sesion.sesionGemini) {
    logger.info(`[STREAM TELNYX] 🤖 Sesión de Gemini creada exitosamente. Iniciando loop de escucha de Gemini...`);
    // Iniciar loop de recepción de mensajes de Gemini
    procesarMensajesGemini(
      sesion.sesionGemini,
      userId,
      callControlId,
      streamId,
      (sid, audio) => {
        sesion.guard?.registrarVozIA();
        enviarATelnyx(ws, sid, audio);
      },
      (texto, rol, ts) => sesion.transcripts.push({ texto, rol, ts }),
      esOutbound
        ? "[SISTEMA] El cliente acaba de contestar esta LLAMADA SALIENTE. Preséntate como el asistente del negocio, explica brevemente el motivo de la llamada y pregunta cómo puedes ayudar."
        : "[SISTEMA] La llamada acaba de conectarse. Saluda ahora al cliente siguiendo tu instrucción: preséntate con el nombre del negocio, saluda amablemente y pregunta cómo puedes ayudar."
    ).catch((e) => {
      logger.error({ error: (e as Error).message, callControlId }, "[STREAM TELNYX] ❌ Error en loop de procesarMensajesGemini");
    });
  } else {
    logger.warn({ callControlId }, "[STREAM TELNYX] ⚠️ Sesión Gemini no disponible - ejecutando Fallback de Audio");
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

  // Guardia anti-eco/sordera con la sensibilidad configurada en el panel admin
  const vadCfg = await vadConfigManager.getConfig();
  sesion.vadBase = vadCfg.vad_base_threshold || 0.62;
  sesion.vadBoost = vadCfg.vad_noise_boost ?? 0.15;
  sesion.guard = new BargeInGuard(
    vadCfg.vad_ai_speaking_window ?? 250,
    vadCfg.vad_ignore_audio_until ?? 500
  );

  // Detector de voz (Silero VAD) para barge-in preciso y filtrado de ruido.
  // Telnyx envía μ-law 8kHz: se declara sampleRate 8000 y la librería
  // re-muestrea a 16k internamente.
  sesion.detectorVoz = await crearSileroVAD(
    () => {
      if (sesion.guard?.debeIgnorarSpeechStart()) {
        logger.debug({ callControlId }, "🔇 Barge-in ignorado (eco inicial o sordera post-interrupción)");
        return;
      }
      sesion.guard?.registrarInterrupcion();
      sesion.isSpeaking = true;
      if (sesion.sesionGemini?.readyState === 1) {
        logger.info({ callControlId }, "🎤 Usuario empezó a hablar (Silero ML) -> Interrumpiendo IA (Telnyx)");
        sesion.sesionGemini.send(JSON.stringify({ clientContent: { turns: [], turnComplete: false } }));
        // Limpiar buffer de Telnyx (barge-in real)
        enviarClearATelnyx(ws, sesion.streamId);
      }
    },
    () => {
      sesion.isSpeaking = false;
      if (sesion.sesionGemini?.readyState === 1) {
        logger.info({ callControlId }, "🛑 Usuario terminó de hablar (Silero ML) -> IA procesando respuesta (Telnyx)");
        sesion.sesionGemini.send(JSON.stringify({ clientContent: { turns: [], turnComplete: true } }));
      }
    },
    8000
  );

  // Notificar al dueño
  emitirSSE(userId, "llamada_iniciada", { callSid: callControlId, from });
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
  if (track !== "inbound") return;
  if (!sesion.sesionGemini) {
    if (!sesion.alertaMediaSinGemini) {
      logger.warn({ callControlId }, "[STREAM TELNYX] Recibiendo audio (media) pero Gemini no está inicializado (¿faltó evento start?)");
      sesion.alertaMediaSinGemini = true; // Solo loguear una vez
    }
    return;
  }

  // Detección de barge-in y Voice Activity (Silero VAD - ML, distingue voz de ruido)
  const mulawBuf = Buffer.from(payload, "base64");
  const pcmSamples = g711.ulawToPCM(mulawBuf);
  
  if (sesion.detectorVoz) {
    const float32 = new Float32Array(pcmSamples.length);
    for (let i = 0; i < pcmSamples.length; i++) {
      float32[i] = pcmSamples[i] / 32768.0;
    }
    // Umbral adaptativo (vad_noise_boost): más estricto mientras la IA habla
    // para que el eco/ruido no dispare barge-in falsos.
    sesion.detectorVoz.setUmbral(
      sesion.guard?.iaHablando()
        ? Math.min(1, sesion.vadBase + sesion.vadBoost)
        : sesion.vadBase
    );
    sesion.detectorVoz.process(float32);
  }

  // Filtro estricto: Si Silero VAD determina que no hay voz, NO enviamos el audio a Gemini.
  // Esto aísla a la IA completamente del ruido de fondo de la llamada.
  if (!sesion.isSpeaking) {
    return;
  }

  // Transcodificar Telnyx (μ-law 8k) → Gemini (PCM 16k)
  const pcm16k = await transcodificarTelefoníaAGemini(payload);

  // Enviar a Gemini como input en tiempo real
  try {
    if (sesion.sesionGemini.readyState === 1) { // 1 = OPEN
      sesion.sesionGemini.send(JSON.stringify({
        realtimeInput: {
          audio: {
            mimeType: "audio/pcm;rate=16000",
            data: pcm16k.toString("base64")
          }
        }
      }));
    }
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
  const msg: any = {
    event: "media",
    media: { payload: audioBase64 },
  };
  if (streamId && !streamId.startsWith("v3:")) {
    msg.stream_id = streamId;
  }
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function enviarClearATelnyx(ws: WebSocket, streamId: string): void {
  // Telnyx no tiene evento "clear" nativo, enviamos media vacía o usamos fork_stop
  // Como workaround, enviamos media vacía para limpiar buffer
  const msg: any = {
    event: "media",
    media: { payload: "" },
  };
  if (streamId && !streamId.startsWith("v3:")) {
    msg.stream_id = streamId;
  }
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
    logger.debug({ streamId }, "Clear enviado a Telnyx (barge-in workaround)");
  }
}

export function obtenerLlamadasActivasTelnyx(): number {
  return sesionesActivas.size;
}