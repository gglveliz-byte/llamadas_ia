/**
 * Detección de voz real (WebRTC VAD) con fallback por energía.
 * WebRTC VAD es un clasificador ML (GMM) compilado a WASM: distingue voz
 * humana de ruido de fondo, ideal para barge-in y detección de actividad.
 *
 * Telnyx envía frames de 20ms μ-law 8kHz (160 muestras PCM) — tamaño exacto
 * que WebRTC VAD espera (10/20/30ms @ 8kHz).
 */
import * as fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import * as ort from "onnxruntime-node";
import vadFactory, { type WebrtcVadModule } from "@ennuicastr/webrtcvad.js";
import {
  RealTimeVAD,
  getDefaultRealTimeVADOptions,
  type RealTimeVADOptions,
} from "@ericedouard/vad-node-realtime";
import { logger } from "../utils/logger";
import { db } from "../models/database.pool";

const UMBRAL_ENERGIA_DBFS = -40;

/**
 * Sesión ONNX de Silero VAD compartida entre todas las llamadas.
 * La librería @ericedouard/vad-node-realtime crea un InferenceSession nuevo en
 * cada RealTimeVAD.new() (~1.4s/llamada). Reutilizando la sesión ahorramos esa
 * carga; cada llamada mantiene su propio tensor de estado (stateN), así que es
 * seguro ante concurrencia (session.run es thread-safe en onnxruntime-node).
 */
interface SesionSileroCompartida {
  session: ort.InferenceSession;
  sr: ort.Tensor;
}

let promesaSesionSilero: Promise<SesionSileroCompartida> | null = null;

function obtenerRutaModeloV5(): string {
  const entrada = require.resolve("@ericedouard/vad-node-realtime");
  return path.join(path.dirname(entrada), "silero_vad_v5.onnx");
}

export function prewarmSileroVAD(): Promise<SesionSileroCompartida> {
  if (!promesaSesionSilero) {
    promesaSesionSilero = (async () => {
      const data = await fs.promises.readFile(obtenerRutaModeloV5());
      const session = await ort.InferenceSession.create(data.buffer);
      const sr = new ort.Tensor("int64", [16000n]);
      logger.info("Silero VAD (ONNX v5) precargado - sesión compartida lista");
      return { session, sr };
    })().catch((e) => {
      promesaSesionSilero = null;
      logger.error({ error: (e as Error).message }, "Error precargando Silero VAD");
      throw e;
    });
  }
  return promesaSesionSilero;
}

/**
 * Replica el modelo SileroV5 de la librería pero compartiendo la sesión ONNX
 * (cargada una vez al boot). El estado recurrente es por-instancia.
 */
function crearModeloSileroV5(shared: SesionSileroCompartida) {
  const getNewState = () => {
    const zeroes = Array(2 * 128).fill(0);
    return new ort.Tensor("float32", zeroes, [2, 1, 128]);
  };
  let state: ort.Tensor = getNewState();
  return {
    process: async (audioFrame: Float32Array) => {
      const t = new ort.Tensor("float32", audioFrame, [1, audioFrame.length]);
      const out = await shared.session.run({
        input: t,
        state,
        sr: shared.sr,
      });
      state = out["stateN"] as ort.Tensor;
      const [isSpeech] = (out["output"] as ort.Tensor).data as unknown as number[];
      return { isSpeech, notSpeech: 1 - isSpeech };
    },
    reset_state: () => {
      state = getNewState();
    },
  };
}

/**
 * El constructor de RealTimeVAD es protected; un subclass permite inyectar un
 * modelInstance construido sobre la sesión ONNX compartida.
 */
class RealTimeVADConSesionCompartida extends RealTimeVAD {
  constructor(options: RealTimeVADOptions, modelInstance: any) {
    super(options, modelInstance);
  }
}

export class VADAccumulator {
  private buffer = new Float32Array(0);
  private chunkSize = 512;
  private vad: RealTimeVAD;
  private processingPromise = Promise.resolve();
  private liberado = false;

  constructor(vad: RealTimeVAD) {
    this.vad = vad;
  }

  /**
   * Ajusta el umbral de voz en caliente (vad_noise_boost adaptativo).
   * Defensivo: si los internals de la librería cambian, simplemente no aplica.
   */
  setUmbral(umbral: number) {
    try {
      const opciones = (this.vad as any)?.frameProcessor?.options;
      if (opciones) opciones.positiveSpeechThreshold = umbral;
    } catch {}
  }
  
  process(newData: Float32Array) {
    if (this.liberado) return;
    
    const combined = new Float32Array(this.buffer.length + newData.length);
    combined.set(this.buffer, 0);
    combined.set(newData, this.buffer.length);
    
    const chunks: Float32Array[] = [];
    let offset = 0;
    while (offset + this.chunkSize <= combined.length) {
      chunks.push(combined.slice(offset, offset + this.chunkSize));
      offset += this.chunkSize;
    }
    this.buffer = combined.slice(offset);

    this.processingPromise = this.processingPromise.then(async () => {
      for (const chunk of chunks) {
        if (this.liberado) break;
        try {
          const t0 = performance.now();
          await this.vad.processAudio(chunk);
          const t1 = performance.now();
          if (t1 - t0 > 25) {
            logger.warn({ timeMs: Math.round(t1 - t0) }, "⚠️ Cuello de botella en VAD: Procesamiento lento");
          }
        } catch (e) {
          logger.warn({ error: (e as Error).message }, "VAD chunk error");
        }
      }
    });
  }

  liberar() {
    this.liberado = true;
    // Liberar referencias y detener VAD si tiene stop()
    try {
      if ((this.vad as any).stop) {
        (this.vad as any).stop();
      }
    } catch {}
  }
}

/**
 * Gestor de configuración VAD dinámico. Lee los valores del AdminConfig
 * y los mantiene cacheados en memoria para acceso ultra-rápido durante el streaming.
 */
export class VadConfigManager {
  private configCache: Record<string, number | string> = {
    vad_base_threshold: 0.66,
    vad_min_frames: 3,
    vad_noise_boost: 0.25,
    vad_ignore_audio_until: 500,
    vad_ai_speaking_window: 400,
    vad_negative_threshold: 0.45,
    gemini_prefix_pad_ms: 250,
    gemini_silence_ms: 250,
    flujo_audio: "continuo",
  };
  private lastFetch: number = 0;
  private readonly CACHE_TTL_MS = 10000; // 10s

  public async getConfig() {
    const now = Date.now();
    if (now - this.lastFetch > this.CACHE_TTL_MS) {
      try {
        const dbConfigs = await db.adminConfig.findMany({
          where: {
            OR: [
              { clave: { startsWith: "vad_" } },
              { clave: { startsWith: "gemini_" } },
              { clave: "flujo_audio" },
            ],
          },
        });
        for (const c of dbConfigs) {
          const num = parseFloat(c.valor);
          if (!isNaN(num)) {
            this.configCache[c.clave] = num;
          } else {
            this.configCache[c.clave] = c.valor;
          }
        }
        this.lastFetch = now;
      } catch (error) {
        logger.error({ error: (error as Error).message }, "Error al actualizar caché VAD");
      }
    }
    return this.configCache;
  }
}

export const vadConfigManager = new VadConfigManager();

/**
 * Guardia anti-eco / anti-fantasma para barge-in.
 * - vad_ai_speaking_window: inmunidad anti-eco mientras la IA habla y hasta
 *   X ms después de su último audio (su propia voz no debe interrumpirla).
 * - vad_ignore_audio_until: sordera post-interrupción para evitar que el
 *   audio residual ("fantasma") re-dispare el barge-in.
 */
export class BargeInGuard {
  private ultimaVozIA = 0;
  private inicioVozIA = 0;
  private ultimaInterrupcion = 0;

  constructor(
    private aiWindowMs: number,
    private ignoreMs: number
  ) {}

  /** Registrar cada chunk de audio de la IA enviado al cliente/Telnyx. */
  registrarVozIA() {
    const now = Date.now();
    // Si hubo una pausa > 300ms, arranca una nueva intervención de la IA
    if (this.ultimaVozIA === 0 || now - this.ultimaVozIA > 300) {
      this.inicioVozIA = now;
    }
    this.ultimaVozIA = now;
  }

  /** La IA sigue "hablando" hasta aiWindowMs después de su último audio. */
  iaHablando(now: number = Date.now()): boolean {
    return this.ultimaVozIA > 0 && now - this.ultimaVozIA <= this.aiWindowMs;
  }

  /** Inmunidad anti-eco: solo los primeros aiWindowMs de cada intervención. */
  private enVentanaAntiEco(now: number): boolean {
    return this.inicioVozIA > 0 && now - this.inicioVozIA <= this.aiWindowMs;
  }

  /** true = el speech-start debe ignorarse (eco inicial o sordera post-interrupción). */
  debeIgnorarSpeechStart(now: number = Date.now()): boolean {
    if (this.ultimaInterrupcion > 0 && now - this.ultimaInterrupcion < this.ignoreMs) {
      return true;
    }
    return this.enVentanaAntiEco(now);
  }

  registrarInterrupcion() {
    this.ultimaInterrupcion = Date.now();
  }
}

export interface DetectorVoz {
  tieneVoz(pcm16Buffer: Buffer): boolean;
  liberar(): void;
}

let moduloVadPromise: Promise<WebrtcVadModule | null> | null = null;

async function obtenerModuloVad(): Promise<WebrtcVadModule | null> {
  if (moduloVadPromise) return moduloVadPromise;
  moduloVadPromise = (async () => {
    try {
      const mod = await vadFactory();
      if (typeof mod._WebRtcVad_Create !== "function") {
        throw new Error("API de WebRTC VAD incompleta");
      }
      logger.info("WebRTC VAD (wasm) cargado correctamente");
      return mod;
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Error cargando WebRTC VAD - usando VAD por energía");
      return null;
    }
  })();
  return moduloVadPromise;
}

/**
 * Crea un detector de voz para una llamada (una instancia por llamada).
 * Usa WebRTC VAD (ML) si el módulo WASM está disponible; si no, energía.
 */
export async function crearDetectorVoz(sampleRate: number = 8000, modo: number = 1): Promise<DetectorVoz> {
  const mod = await obtenerModuloVad();
  if (mod) {
    try {
      const vad = mod._WebRtcVad_Create();
      if (!vad) throw new Error("WebRtcVad_Create devolvió 0");
      mod._WebRtcVad_Init(vad);
      mod._WebRtcVad_set_mode(vad, modo);

      // Frame de 20ms (160 muestras @ 8kHz, 320 @ 16kHz)
      const samplesPorFrame = Math.round(sampleRate * 0.02);
      const bufPtr = mod._malloc(samplesPorFrame * 2);
      const heap = new Int16Array(mod.HEAP16.buffer, bufPtr, samplesPorFrame);

      return {
        tieneVoz: (pcm16Buffer: Buffer): boolean => {
          const numFrames = Math.floor(pcm16Buffer.length / (samplesPorFrame * 2));
          if (numFrames === 0) return false;
          const src = new Int16Array(
            pcm16Buffer.buffer,
            pcm16Buffer.byteOffset,
            numFrames * samplesPorFrame
          );
          try {
            for (let f = 0; f < numFrames; f++) {
              for (let i = 0; i < samplesPorFrame; i++) {
                heap[i] = src[f * samplesPorFrame + i];
              }
              if (mod._WebRtcVad_Process(vad, sampleRate, bufPtr, samplesPorFrame) === 1) {
                return true;
              }
            }
          } catch (e) {
            logger.debug({ error: (e as Error).message }, "Error en WebRTC VAD Process - usando energía");
            return tieneVozPorEnergia(pcm16Buffer);
          }
          return false;
        },
        liberar: (): void => {
          try {
            mod._free(bufPtr);
          } catch {}
          try {
            mod._WebRtcVad_Free(vad);
          } catch {}
        },
      };
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Error creando detector WebRTC VAD - usando energía");
    }
  }
  // Fallback: VAD por energía
  return {
    tieneVoz: (pcm: Buffer): boolean => tieneVozPorEnergia(pcm),
    liberar: (): void => {},
  };
}

/**
 * Verifica en el arranque que el módulo WebRTC VAD se pueda cargar.
 */
export async function verificarVad(): Promise<boolean> {
  const mod = await obtenerModuloVad();
  if (mod) {
    logger.info("✅ WebRTC VAD disponible (barge-in ML)");
    return true;
  }
  logger.error("❌ WebRTC VAD no disponible - se usará VAD por energía");
  return false;
}

/**
 * Detecta si un buffer PCM 16-bit contiene voz real basado en energía.
 * Fallback cuando WebRTC VAD no está disponible.
 */
export function tieneVozPorEnergia(pcm16BitBuffer: Buffer, umbralDbfs: number = UMBRAL_ENERGIA_DBFS): boolean {
  if (pcm16BitBuffer.length < 2) return false;
  let sumSquares = 0;
  const numSamples = pcm16BitBuffer.length / 2;
  for (let i = 0; i < numSamples; i++) {
    const s = pcm16BitBuffer.readInt16LE(i * 2);
    sumSquares += s * s;
  }
  const rms = Math.sqrt(sumSquares / numSamples);
  if (rms === 0) return false;
  const dbfs = 20 * Math.log10(rms / 32767);
  const hayVoz = dbfs > umbralDbfs;
  if (hayVoz) {
    logger.debug({ dbfs: dbfs.toFixed(1) }, "Voz detectada por energía");
  }
  return hayVoz;
}

/**
 * Crea una instancia de Silero VAD (ONNX ML) configurada dinámicamente
 * y envuelta en nuestro VADAccumulator para soportar streaming asimétrico.
 */
export async function crearSileroVAD(
  onSpeechStart: () => void,
  onSpeechEnd: () => void,
  sampleRate: number = 16000,
  onVADMisfire?: () => void,
  onFrameProcessed?: (probs: { isSpeech: number; isSilence?: number }, frame: Float32Array) => void
): Promise<VADAccumulator | null> {
  try {
    const config = await vadConfigManager.getConfig();

    const opcionesCallbacks = {
      positiveSpeechThreshold: Number(config.vad_base_threshold) || 0.65,
      negativeSpeechThreshold: Number(config.vad_negative_threshold) || 0.45,
      redemptionFrames: Number(config.vad_min_frames) ? Number(config.vad_min_frames) * 5 : 20, // Approx ~100-600ms
      sampleRate, // la librería re-muestrea a 16k internamente
      onSpeechStart,
      onSpeechEnd,
      onVADMisfire: onVADMisfire ?? (() => {}),
      onFrameProcessed: onFrameProcessed ?? (() => {}),
    };

    // Primero intentar la sesión ONNX compartida (precargada al boot) para no
    // pagar la carga del modelo (~1.4s) en cada llamada.
    try {
      const shared = await prewarmSileroVAD();
      const vad = new RealTimeVADConSesionCompartida(
        { ...getDefaultRealTimeVADOptions("v5"), ...opcionesCallbacks },
        crearModeloSileroV5(shared)
      );
      vad.start();
      return new VADAccumulator(vad);
    } catch (e) {
      logger.error(
        { error: (e as Error).message },
        "Sesión Silero compartida no disponible - usando carga estándar"
      );
      const vad = await RealTimeVAD.new(opcionesCallbacks);
      vad.start();
      return new VADAccumulator(vad);
    }
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error cargando Silero VAD, fallback...");
    return null;
  }
}
