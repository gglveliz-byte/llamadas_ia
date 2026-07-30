/**
 * Transcodificación de audio Twilio ↔ Gemini.
 * Cumple spec sección 7.2.
 *
 * Twilio envía:   G.711 μ-law, 8kHz, mono, Base64
 * Gemini espera:  PCM 16-bit, 16kHz, Little-Endian
 *
 * Gemini envía:   PCM 16-bit, 24kHz, Little-Endian, Base64
 * Twilio espera:  G.711 μ-law, 8kHz, Base64
 */
import { logger } from "./logger";

// Tabla μ-law → lineal PCM 16-bit (G.711 standard)
const mulawToLinearTable = new Int16Array(256);
const linearToMulawTable = new Uint8Array(65536);

// Inicializar tablas μ-law
function initMulawTables() {
  for (let i = 0; i < 256; i++) {
    let sample = i ^ 0xff; // Invertir bits (μ-law usa lógica negativa)
    let sign = (sample & 0x80) !== 0;
    let exponent = (sample >> 4) & 0x07;
    let mantissa = sample & 0x0f;
    let magnitude = ((mantissa << 3) + 0x84) << exponent;
    let linear = sign ? magnitude : -magnitude;
    // Clamp a Int16
    mulawToLinearTable[i] = Math.max(-32768, Math.min(32767, linear));
  }

  for (let linear = -32768; linear <= 32767; linear++) {
    linearToMulawTable[linear + 32768] = linearToMulaw(linear);
  }
}

function linearToMulaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = 0;
  let adjusted = sample;
  if (sample < 0) {
    sign = 0x80;
    adjusted = -sample;
  }
  if (adjusted > CLIP) adjusted = CLIP;
  adjusted += BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (adjusted & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }

  let mantissa = (adjusted >> (exponent + 3)) & 0x0f;
  let mulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return mulawByte;
}

initMulawTables();

/**
 * Decodifica Base64 → Buffer
 */
export function decodeBase64(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

/**
 * Codifica Buffer → Base64
 */
export function encodeBase64(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}

/**
 * Convierte μ-law 8kHz → PCM 16-bit 16kHz (Twilio → Gemini).
 * 1. Decode Base64
 * 2. μ-law → PCM lineal 16-bit (tabla)
 * 3. Resample 8kHz → 16kHz (interpolación lineal simple, factor 2)
 */
export function transcodificarTwilioAGemini(mulawBase64: string): Buffer {
  const mulawBuf = decodeBase64(mulawBase64);
  const pcm8k = new Int16Array(mulawBuf.length);
  for (let i = 0; i < mulawBuf.length; i++) {
    pcm8k[i] = mulawToLinearTable[mulawBuf[i]];
  }

  // Resample 8k → 16k: duplicar cada muestra (interpolación zero-order hold)
  const pcm16k = Buffer.alloc(pcm8k.length * 4); // 2x samples * 2 bytes
  for (let i = 0; i < pcm8k.length; i++) {
    const sample = pcm8k[i];
    // Escribir muestra original y repetida (interpolación)
    pcm16k.writeInt16LE(sample, i * 4);
    pcm16k.writeInt16LE(sample, i * 4 + 2);
  }

  return pcm16k;
}

/**
 * Convierte PCM 16-bit 24kHz → μ-law 8kHz Base64 (Gemini → Twilio).
 * 1. Decode Base64
 * 2. Resample 24kHz → 8kHz (decimación factor 3)
 * 3. PCM lineal → μ-law (tabla)
 * 4. Encode Base64
 */
export function transcodificarGeminiATwilio(pcm24kBase64: string): string {
  const pcm24kBuf = decodeBase64(pcm24kBase64);
  const samples24k = new Int16Array(pcm24kBuf.buffer, pcm24kBuf.byteOffset, pcm24kBuf.length / 2);

  // Resample 24k → 8k: tomar 1 de cada 3 muestras (decimación simple)
  // En producción se aplicaría filtro anti-aliasing previo
  const samples8k = new Int16Array(Math.floor(samples24k.length / 3));
  for (let i = 0; i < samples8k.length; i++) {
    samples8k[i] = samples24k[i * 3];
  }

  // PCM lineal → μ-law
  const mulawBuf = Buffer.alloc(samples8k.length);
  for (let i = 0; i < samples8k.length; i++) {
    const linear = samples8k[i];
    mulawBuf[i] = linearToMulawTable[linear + 32768];
  }

  return encodeBase64(mulawBuf);
}

/**
 * Calcula la energía RMS de un frame PCM para VAD (Voice Activity Detection).
 * Retorna en dBFS. Útil para filtro de ruido antes de barge-in (spec 7.5).
 */
export function calcularEnergiaPCM(pcmBase64: string): number {
  const buf = decodeBase64(pcmBase64);
  if (buf.length < 2) return -100;

  let sumSquares = 0;
  const numSamples = buf.length / 2;
  for (let i = 0; i < numSamples; i++) {
    const sample = buf.readInt16LE(i * 2);
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / numSamples);
  if (rms === 0) return -100;
  // Convertir a dBFS (referencia 32767 = 0 dBFS)
  const dbfs = 20 * Math.log10(rms / 32767);
  return dbfs;
}

/**
 * Verifica si un frame tiene voz real (energía > umbral, default -40dBFS).
 * Cumple spec 7.5 - filtro de ruido antes de barge-in.
 */
export function tieneVoz(pcmBase64: string, umbralDbfs: number = -40): boolean {
  return calcularEnergiaPCM(pcmBase64) > umbralDbfs;
}

logger.info("Audio transcoder inicializado (μ-law ↔ PCM 16kHz/24kHz)");
