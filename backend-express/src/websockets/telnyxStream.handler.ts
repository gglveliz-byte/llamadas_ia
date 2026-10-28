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
import { crearSesionGemini, procesarMensajesGemini } from "./gemini.handler";
const MODELO = process.env.GEMINI_MODEL || "models/gemini-3.1-flash-live-preview";
import { transcodificarTelefoníaAGemini, transcodificarGeminiATelefonía } from "../utils/audioTranscoder";
import { startRecording, hangupCall } from "../services/telnyx.service";
import { crearSileroVAD, VADAccumulator, BargeInGuard, vadConfigManager } from "../services/vad.service";
import { verificarSaldo, debitarLlamada } from "../services/billing.service";
import { incrementarLlamadasActivas, decrementarLlamadasActivas } from "../services/monitoring.service";
import { incrementarConcurrenciaTelnyx, decrementarConcurrenciaTelnyx } from "../services/ratelimit.service";
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
  customerPhone: string;
  inicio: number;
  sesionGemini: Awaited<ReturnType<typeof crearSesionGemini>> | null;
  detectorVoz: VADAccumulator | null;
  guard: BargeInGuard | null;
  vadBase: number;
  vadBoost: number;
  ultimaActividadGemini: number;
  isSpeaking: boolean;
  flujoAudio: string;
  preRoll: Buffer[];
  preRollBytes: number;
  ultimaActividadVoz: number;
  timeoutFinTurno: ReturnType<typeof setTimeout> | null;
  grabacionActiva: boolean;
  finalizada: boolean;
  transcripts: Array<{ texto: string; rol: string; ts: number }>;
  settings: {
    aiLanguage: string;
    grabacionActiva: boolean;
  } | null;
  alertaMediaSinGemini?: boolean;
  esperandoRespuestaIA?: boolean;
  inactividadWatchdog?: ReturnType<typeof setInterval> | null;
  ws?: import("ws");
  inactividadAvisoEnviado?: boolean;
  primerTurnoIACompletado?: boolean;
}

const sesionesActivas = new Map<string, SesionLlamada>();

// Pre-roll de ~250ms de PCM16 16kHz (250ms * 16000 muestras/s * 2 bytes) para
// el modo "gated": se vacía al detectar habla para no perder el arranque.
const PRE_ROLL_MAX_BYTES = 250 * 16000 * 2 / 1000;

// Buffer de inicio de ~3s de PCM16 16kHz: retiene el audio del llamante mientras
// la sesión de Gemini se inicializa, para no perder el arranque de la llamada.
const INIT_BUFFER_MAX_BYTES = 3 * 16000 * 2;

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
    const customerPhone = url.searchParams.get("customer_phone") || "";

    if (!userId || !callControlId) {
      logger.error({ url: req.url }, "WebSocket Telnyx sin user_id o call_control_id");
      ws.close(1008, "Parámetros faltantes");
      return;
    }

    logger.info({ callControlId, userId }, "WebSocket Telnyx Stream conectado");
    incrementarLlamadasActivas();

    const sesion: SesionLlamada = {
      callControlId,
      streamId: "", // se llena en start o connected
      userId,
      customerPhone,
      inicio: Date.now(),
      sesionGemini: null,
      detectorVoz: null,
      guard: null,
      vadBase: 0.62,
      vadBoost: 0.15,
      ultimaActividadGemini: Date.now(),
      isSpeaking: false,
      flujoAudio: "continuo",
      preRoll: [],
      preRollBytes: 0,
      ultimaActividadVoz: Date.now(),
      timeoutFinTurno: null,
      grabacionActiva: false,
      finalizada: false,
      transcripts: [],
      settings: null,
      inactividadWatchdog: null,
      inactividadAvisoEnviado: false,
      ws,
      primerTurnoIACompletado: false,
    };

    // Registrar listeners ANTES de los awaits: el navegador envía 'start'
    // apenas se abre el socket y no debe perderse (race condition).
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
          logger.info({ version: (mensaje as any)?.version }, "Telnyx stream connected");
          break;
        case "start":
          try {
            if (!sesion.streamId || sesion.streamId.startsWith("v3:")) {
              sesion.streamId = (mensaje as any)?.stream_id || (mensaje as any)?.start?.stream_id || callControlId;
              
              // Evitar doble inicialización de Gemini
              if (!sesion.sesionGemini) {
                logger.info(`[STREAM TELNYX] 🔗 Recibido evento 'start'. Iniciando conexión con Gemini para la llamada...`);
                await manejarStart(ws, userId, callControlId, sesion, esOutbound, mensaje);
              }
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

    // Verificar saldo antes de iniciar (después de registrar listeners)
    await incrementarConcurrenciaTelnyx();
    const { saldoOk } = await verificarSaldo(userId, customerPhone);
    if (!saldoOk) {
      logger.warn({ callControlId, userId }, "Llamada rechazada por saldo insuficiente");
      ws.close(1011, "Saldo insuficiente");
      return;
    }

    // Cargar settings del negocio (manejarStart los recarga si llegan null)
    const settings = await db.businessSettings.findUnique({ where: { userId } });
    if (settings) {
      sesion.settings = {
        aiLanguage: settings.aiLanguage,
        grabacionActiva: settings.grabacionActiva,
      };
      sesion.grabacionActiva = settings.grabacionActiva;
    }
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
  // Telnyx envía stream_id al nivel raíz del evento start; fallback a callControlId.
  const streamId = mensaje?.stream_id || mensaje?.start?.stream_id || callControlId;
  sesion.streamId = streamId;

  const metric = await db.callMetric.findFirst({ where: { callSid: callControlId }});
  const from = mensaje?.start?.from || metric?.callerNumber || "desconocido";
  const to = mensaje?.start?.to || metric?.toNumber || "desconocido";

  logger.info({ callControlId, streamId, from, to, mediaFormat: mensaje?.start?.media_format }, `[STREAM TELNYX] 🚀 Evento 'start' / 'connected' procesado. streamId asignado: ${streamId}`);

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

  // Iniciar grabación nativa si está activa
  if (sesion.grabacionActiva && !callControlId.startsWith("test_")) {
    await startRecording(callControlId, "wav").catch(e => logger.error({ error: e.message, callControlId }, "Error iniciando grabación nativa"));
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
    sesion.sesionGemini.on("turnComplete", () => {
      if (!sesion.primerTurnoIACompletado) {
        logger.info({ callControlId }, "Primer turno de la IA completado. Barge-in activado.");
        sesion.primerTurnoIACompletado = true;
      }
    });

    logger.info(`[STREAM TELNYX] 🤖 Sesión de Gemini creada exitosamente. Iniciando loop de escucha de Gemini...`);
    // Volcar el audio buffereado durante la inicialización (~3s) para no perder
    // el arranque de la llamada.
    if (sesion.preRoll.length > 0) {
      logger.info({ callControlId, chunks: sesion.preRoll.length }, "[STREAM TELNYX] Volcando audio buffereado a Gemini");
      for (const chunk of sesion.preRoll) {
        enviarPCMAGemini(sesion, chunk);
      }
      sesion.preRoll = [];
      sesion.preRollBytes = 0;
    }
    // Iniciar loop de recepción de mensajes de Gemini
    procesarMensajesGemini(
      sesion.sesionGemini,
      userId,
      callControlId,
      streamId,
      (sid, audio) => {
        sesion.guard?.registrarVozIA();
        // Calcular duración del audio enviado (16kHz 16-bit PCM = 32 bytes/ms)
        const bytes = Buffer.from(audio, "base64").length;
        const duracionMs = Math.round(bytes / 32);
        
        // El watchdog cuenta desde el futuro en que la IA termina de hablar
        const ahora = Date.now();
        sesion.ultimaActividadVoz = Math.max(sesion.ultimaActividadVoz, ahora) + duracionMs;
        // Métrica de latencia real: desde el último frame de voz del usuario
        // hasta el primer chunk de audio de la IA.
        if (sesion.esperandoRespuestaIA) {
          sesion.esperandoRespuestaIA = false;
          const respuestaLatenciaMs = Date.now() - sesion.ultimaActividadVoz;
          logger.info({ callControlId, respuestaLatenciaMs }, "Respuesta IA - latencia desde fin de turno de usuario");
        }
        enviarATelnyx(ws, sid, audio);
      },
      (texto, rol, ts) => sesion.transcripts.push({ texto, rol, ts }),
      esOutbound
        ? "[SISTEMA] El cliente acaba de contestar esta LLAMADA SALIENTE. Preséntate como el asistente del negocio, explica brevemente el motivo de la llamada y pregunta cómo puedes ayudar."
        : "[SISTEMA] La llamada acaba de conectarse. Saluda ahora al cliente siguiendo tu instrucción: preséntate con el nombre del negocio, saluda amablemente y pregunta cómo puedes ayudar."
    ).catch((e) => {
      logger.error({ error: (e as Error).message, callControlId }, "[STREAM TELNYX] ❌ Error en loop de procesarMensajesGemini");
    });
    
    // Iniciar watchdog de inactividad (cada 2 segundos)
    if (sesion.inactividadWatchdog) clearInterval(sesion.inactividadWatchdog);
    sesion.inactividadWatchdog = setInterval(() => {
      if (sesion.finalizada || !sesion.sesionGemini) return;
      
      const tiempoInactivo = Date.now() - sesion.ultimaActividadVoz;
      
      // Hard timeout: 20 segundos
      if (tiempoInactivo >= 20000) {
        logger.warn({ callControlId, tiempoInactivo }, "Timeout duro por inactividad (20s). Colgando llamada.");
        hangupCall(callControlId).catch(() => {});
        if (callControlId.startsWith("test_")) ws.close(1000, "Timeout inactividad");
        sesion.finalizada = true;
        if (sesion.inactividadWatchdog) clearInterval(sesion.inactividadWatchdog);
      }
      // Soft timeout: 10 segundos
      else if (tiempoInactivo >= 10000 && !sesion.inactividadAvisoEnviado) {
        sesion.inactividadAvisoEnviado = true;
        logger.info({ callControlId, tiempoInactivo }, "Enviando aviso de inactividad a Gemini (10s)");
        sesion.sesionGemini.send(JSON.stringify({
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [{ text: "[SISTEMA] No has escuchado al cliente en los últimos 10 segundos. Pregúntale de forma breve y natural si sigue ahí o si puedes ayudarle en algo más. Si el cliente no responde después de esto, usa tu herramienta finalizar_llamada para colgar." }]
              }
            ],
            turnComplete: true
          }
        }));
      }
    }, 2000);

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
  sesion.vadBase = Number(vadCfg.vad_base_threshold) || 0.62;
  sesion.vadBoost = Number(vadCfg.vad_noise_boost) ?? 0.15;
  sesion.flujoAudio = (vadCfg.flujo_audio as string) || "continuo";
  sesion.guard = new BargeInGuard(
    Number(vadCfg.vad_ai_speaking_window) ?? 250,
    Number(vadCfg.vad_ignore_audio_until) ?? 500
  );

  // Detector de voz (Silero VAD) para barge-in preciso y filtrado de ruido.
  // La librería solo acepta native >= 16kHz; el stream Telnyx llega como L16 16kHz
  // (codec bidireccional L16), así que se alimenta el VAD directamente (ver manejarMedia).
  const cerrarTurno = () => {
    if (!sesion.isSpeaking) return;
    if (sesion.timeoutFinTurno) {
      clearTimeout(sesion.timeoutFinTurno);
      sesion.timeoutFinTurno = null;
    }
    sesion.isSpeaking = false;
    sesion.preRoll = [];
    sesion.preRollBytes = 0;
    sesion.esperandoRespuestaIA = true;
    if (sesion.sesionGemini?.readyState === 1) {
      logger.info({ callControlId }, "🛑 Fin de turno de usuario -> IA procesando respuesta (Telnyx)");
      sesion.sesionGemini.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
  };

  sesion.detectorVoz = await crearSileroVAD(
    () => {
      if (!sesion.primerTurnoIACompletado) {
        logger.debug({ callControlId }, "🔇 Barge-in ignorado (IA protegiendo su primer turno / saludo inicial)");
        return;
      }
      if (sesion.guard?.debeIgnorarSpeechStart()) {
        logger.debug({ callControlId }, "🔇 Barge-in ignorado (eco inicial o sordera post-interrupción)");
        return;
      }
      sesion.guard?.registrarInterrupcion();
      sesion.isSpeaking = true;
      // Interrupción incondicional (receta del simulador): corta el turno de la
      // IA y limpia el buffer de reproducción. El audio real ya fluye a Gemini
      // (modo continuo), así que su auto-VAD retomará el turno al callar.
      if (sesion.sesionGemini?.readyState === 1) {
        logger.info({ callControlId }, "🎤 Usuario empezó a hablar (Silero ML) -> Interrumpiendo IA (Telnyx)");
        sesion.sesionGemini.send(JSON.stringify({ clientContent: { turns: [], turnComplete: false } }));
        enviarClearATelnyx(ws, sesion.streamId);
      }
    },
    cerrarTurno,
    16000,
    () => {
      // Frase demasiado corta para ser SpeechEnd: cerrar el turno igualmente
      // para que la IA responda (ej. "¿Aló?").
      logger.debug({ callControlId }, "VAD misfire (frase corta) -> cerrando turno");
      cerrarTurno();
    },
    (probs) => {
      if (probs?.isSpeech >= (sesion.vadBase ?? 0.62)) {
        sesion.ultimaActividadVoz = Date.now();
        sesion.inactividadAvisoEnviado = false; // El cliente habló, resetear aviso
        // Respaldo: si el ruido de red impide el onSpeechEnd, cerrar el turno
        // poco después de la última actividad de voz.
        if (sesion.timeoutFinTurno) {
          clearTimeout(sesion.timeoutFinTurno);
        }
        sesion.timeoutFinTurno = setTimeout(cerrarTurno, 700);
      }
    }
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

  // Solo procesar inbound con Gemini
  if (track !== "inbound") return;

  // Telnyx envía L16 16kHz (PCM lineal): passthrough directo a Gemini (PCM 16kHz).
  const pcm16k = await transcodificarTelefoníaAGemini(payload);

  if (!sesion.sesionGemini || sesion.sesionGemini.readyState !== 1) {
    if (!sesion.alertaMediaSinGemini) {
      logger.warn({ callControlId }, "[STREAM TELNYX] Recibiendo audio (media) pero Gemini no está inicializado o conectado (¿faltó evento start?)");
      sesion.alertaMediaSinGemini = true; // Solo loguear una vez
    }
    // Bufferear el inicio de la llamada (~3s) para volcarlo a Gemini cuando la
    // sesión quede lista, en vez de perder el audio del arranque.
    sesion.preRoll.push(pcm16k);
    sesion.preRollBytes += pcm16k.length;
    while (sesion.preRollBytes > INIT_BUFFER_MAX_BYTES && sesion.preRoll.length > 0) {
      sesion.preRollBytes -= sesion.preRoll.shift()!.length;
    }
    return;
  }

  // Detección de barge-in y Voice Activity (Silero VAD - ML, distingue voz de ruido)
  if (sesion.detectorVoz) {
    const pcmSamples = new Int16Array(pcm16k.buffer, pcm16k.byteOffset, pcm16k.length / 2);
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

  // Envío a Gemini como input en tiempo real.
  // Half-duplex: mientras la IA habla (guard.iaHablando), NO se reenvía el audio
  // del micrófono a Gemini, para que la IA nunca se escuche a sí misma por el eco
  // del altavoz. El VAD Silero ya se alimentó arriba con el audio mezclado, así
  // que el barge-in real (interrumpir la reproducción) sigue funcionando. Al
  // callar la IA (ventana vad_ai_speaking_window), el audio del usuario fluye.
  // flujo_audio="gated": además, buffer pre-roll de ~250ms que se vacía al
  // detectar habla para no perder el arranque de la palabra.
  const iaHablando = sesion.guard?.iaHablando() ?? false;

  if (sesion.flujoAudio === "gated") {
    if (!iaHablando) {
      sesion.preRoll.push(pcm16k);
      sesion.preRollBytes += pcm16k.length;
      while (sesion.preRollBytes > PRE_ROLL_MAX_BYTES && sesion.preRoll.length > 0) {
        sesion.preRollBytes -= sesion.preRoll.shift()!.length;
      }
      if (sesion.isSpeaking) {
        while (sesion.preRoll.length > 0) {
          enviarPCMAGemini(sesion, sesion.preRoll.shift()!);
        }
        sesion.preRollBytes = 0;
      }
    }
  } else if (!iaHablando) {
    enviarPCMAGemini(sesion, pcm16k);
  }
}

/** Envía un buffer PCM 16kHz 16-bit a la sesión de Gemini como realtimeInput. */
function enviarPCMAGemini(sesion: SesionLlamada, buffer: Buffer): void {
  try {
    if (sesion.sesionGemini?.readyState === 1) { // 1 = OPEN
      sesion.sesionGemini.send(JSON.stringify({
        realtimeInput: {
          audio: {
            mimeType: "audio/pcm;rate=16000",
            data: buffer.toString("base64")
          }
        }
      }));
    }
    sesion.ultimaActividadGemini = Date.now();
  } catch (e) {
    logger.error({ error: (e as Error).message, callControlId: sesion.callControlId }, "Error enviando audio a Gemini");
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
    const { monto, saldoNuevo } = await debitarLlamada(sesion.userId, sesion.customerPhone, callControlId, duracionSegundos);

    // 2. Grabación (ahora es manejada por el webhook nativo call.recording.saved en webhooks.telnyx.ts)

    // 3. Métricas
    const metricCount = await db.callMetric.count({ where: { callSid: callControlId } });
    if (metricCount === 0) {
      await db.callMetric.create({
        data: {
          callSid: callControlId,
          userId: sesion.userId,
          callerNumber: "Prueba Web",
          inicio: new Date(sesion.inicio),
          fin: new Date(),
          duracionSegundos,
          cobroAplicado: monto,
        }
      });
    } else {
      await db.callMetric.updateMany({
        where: { callSid: callControlId },
        data: {
          fin: new Date(),
          duracionSegundos,
          cobroAplicado: monto,
        },
      });
    }

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
    if (sesion.timeoutFinTurno) {
      clearTimeout(sesion.timeoutFinTurno);
      sesion.timeoutFinTurno = null;
    }
    if (sesion.inactividadWatchdog) {
      clearInterval(sesion.inactividadWatchdog);
      sesion.inactividadWatchdog = null;
    }
    sesion.detectorVoz?.liberar();
    sesion.detectorVoz = null;
    sesionesActivas.delete(callControlId);
  }
}

// Helpers para enviar mensajes a Telnyx
function enviarATelnyx(ws: WebSocket, _streamId: string, audioBase64: string): void {
  // IMPORTANTE: Telnyx espera el frame de reproducción SIN stream_id (AsyncAPI
  // Client Media Frame: additionalProperties:false, solo event + media.payload).
  // Agregar stream_id hace que Telnyx descarte el audio y el llamante no oye nada.
  const msg = {
    event: "media",
    media: { payload: audioBase64 },
  };
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function enviarClearATelnyx(ws: WebSocket, _streamId: string): void {
  // Frame oficial "clear" de Telnyx: detiene la reproducción actual y limpia la cola.
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ event: "clear" }));
    logger.debug({ streamId: _streamId }, "Clear enviado a Telnyx (barge-in)");
  }
}

export function obtenerLlamadasActivasTelnyx(): number {
  return sesionesActivas.size;
}

export function cerrarLlamadaWebSocket(callControlId: string): void {
  const sesion = sesionesActivas.get(callControlId);
  if (sesion && sesion.ws) {
    sesion.ws.close(1000, "IA solicitó finalizar la llamada");
  }
}

export function obtenerTiempoRestanteAudio(callControlId: string): number {
  const sesion = sesionesActivas.get(callControlId);
  if (!sesion) return 0;
  const restante = sesion.ultimaActividadVoz - Date.now();
  return Math.max(0, restante);
}