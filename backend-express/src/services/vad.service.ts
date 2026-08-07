/**
 * Detección de voz real (WebRTC VAD) con fallback por energía.
 * WebRTC VAD es un clasificador ML (GMM) compilado a WASM: distingue voz
 * humana de ruido de fondo, ideal para barge-in y detección de actividad.
 *
 * Telnyx envía frames de 20ms μ-law 8kHz (160 muestras PCM) — tamaño exacto
 * que WebRTC VAD espera (10/20/30ms @ 8kHz).
 */
import vadFactory, { type WebrtcVadModule } from "@ennuicastr/webrtcvad.js";
import { RealTimeVAD } from "@ericedouard/vad-node-realtime";
import { logger } from "../utils/logger";
import { db } from "../models/database.pool";

const UMBRAL_ENERGIA_DBFS = -40;

export class VADAccumulator {
  private buffer = new Float32Array(0);
  private chunkSize = 512;
  private vad: RealTimeVAD;
  private processingPromise = Promise.resolve();

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
        try {
          await this.vad.processAudio(chunk);
        } catch (e) {
          logger.warn({ error: (e as Error).message }, "VAD chunk error");
        }
      }
    });
  }

  liberar() {
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
  private configCache: Record<string, number> = {
    vad_base_threshold: 0.62,
    vad_min_frames: 3,
    vad_noise_boost: 0.15,
    vad_ignore_audio_until: 500,
    vad_ai_speaking_window: 250,
  };
  private lastFetch: number = 0;
  private readonly CACHE_TTL_MS = 10000; // 10s

  public async getConfig() {
    const now = Date.now();
    if (now - this.lastFetch > this.CACHE_TTL_MS) {
      try {
        const dbConfigs = await db.adminConfig.findMany({
          where: { clave: { startsWith: "vad_" } },
        });
        for (const c of dbConfigs) {
          const val = parseFloat(c.valor);
          if (!isNaN(val)) this.configCache[c.clave] = val;
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

    const vad = await RealTimeVAD.new({
      positiveSpeechThreshold: config.vad_base_threshold || 0.65,
      redemptionFrames: config.vad_min_frames ? config.vad_min_frames * 5 : 20, // Approx ~100-600ms
      sampleRate, // la librería re-muestrea a 16k internamente
      onSpeechStart,
      onSpeechEnd,
      onVADMisfire: onVADMisfire ?? (() => {}),
      onFrameProcessed: onFrameProcessed ?? (() => {}),
    });
    
    vad.start();
    return new VADAccumulator(vad);
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error cargando Silero VAD, fallback...");
    return null;
  }
}
