import { logger } from "./logger";

function decodeBase64(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

function encodeBase64(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}

export class AudioTranscoder {
  // Telnyx envía L16 16kHz (PCM lineal) y Gemini espera PCM 16kHz: passthrough.
  async transcodeTelefoniaAGemini(l16Base64: string): Promise<Buffer> {
    return decodeBase64(l16Base64);
  }

  // Transcode Gemini (24kHz PCM) a Telnyx (16kHz L16) — solo downsample 2:3.
  async transcodeGeminiATelefonia(pcm24kBase64: string): Promise<string> {
    const pcm24kBuf = decodeBase64(pcm24kBase64);

    const pcm24k = new Int16Array(
      pcm24kBuf.buffer,
      pcm24kBuf.byteOffset,
      pcm24kBuf.length / 2
    );

    const pcm16k = new Int16Array(Math.floor((pcm24k.length * 2) / 3));
    for (let i = 0; i < pcm16k.length; i++) {
      pcm16k[i] = pcm24k[Math.floor(i * 1.5)];
    }

    return encodeBase64(Buffer.from(pcm16k.buffer));
  }

  destroy(): void {}
}

let transcoderInstance: AudioTranscoder | null = null;

export function getAudioTranscoder(): AudioTranscoder {
  if (!transcoderInstance) {
    transcoderInstance = new AudioTranscoder();
    logger.info("Audio transcoder inicializado (L16 16kHz, sin G711)");
  }
  return transcoderInstance;
}

export function transcodificarTelefoníaAGemini(mulawBase64: string): Promise<Buffer> {
  return getAudioTranscoder().transcodeTelefoniaAGemini(mulawBase64);
}

export function transcodificarGeminiATelefonía(pcm24kBase64: string): Promise<string> {
  return getAudioTranscoder().transcodeGeminiATelefonia(pcm24kBase64);
}