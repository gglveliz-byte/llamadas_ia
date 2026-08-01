/**
 * Detección de voz real (WebRTC VAD) con fallback por energía.
 * WebRTC VAD es un clasificador ML (GMM) compilado a WASM: distingue voz
 * humana de ruido de fondo, ideal para barge-in y detección de actividad.
 *
 * Telnyx envía frames de 20ms μ-law 8kHz (160 muestras PCM) — tamaño exacto
 * que WebRTC VAD espera (10/20/30ms @ 8kHz).
 */
import vadFactory, { type WebrtcVadModule } from "@ennuicastr/webrtcvad.js";
import { logger } from "../utils/logger";

const UMBRAL_ENERGIA_DBFS = -40;

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
