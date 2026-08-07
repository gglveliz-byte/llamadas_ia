import { logger } from "./logger";
import g711 from "g711";

function decodeBase64(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

function encodeBase64(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}

export class AudioTranscoder {
  // Transcode Telnyx (8kHz Mu-Law) to Gemini (16kHz PCM)
  async transcodeTelefoniaAGemini(mulawBase64: string): Promise<Buffer> {
    const mulawBuf = decodeBase64(mulawBase64);
    
    // 1. Convert Mu-Law (8kHz) to PCM (8kHz)
    const pcm8k = g711.ulawToPCM(mulawBuf, 16) as unknown as Int16Array;
    
    // 2. Upsample 8kHz to 16kHz (Linear Interpolation)
    const pcm16k = new Int16Array(pcm8k.length * 2);
    for (let i = 0; i < pcm8k.length - 1; i++) {
      const current = pcm8k[i];
      const next = pcm8k[i + 1];
      pcm16k[i * 2] = current;
      pcm16k[i * 2 + 1] = Math.round((current + next) / 2);
    }
    // Handle the last sample
    if (pcm8k.length > 0) {
      const last = pcm8k[pcm8k.length - 1];
      pcm16k[(pcm8k.length - 1) * 2] = last;
      pcm16k[(pcm8k.length - 1) * 2 + 1] = last;
    }
    
    // 3. Convert Int16Array to Buffer (Little Endian)
    return Buffer.from(pcm16k.buffer);
  }

  // Transcode Gemini (24kHz PCM) to Telnyx (8kHz Mu-Law)
  async transcodeGeminiATelefonia(pcm24kBase64: string): Promise<string> {
    const pcm24kBuf = decodeBase64(pcm24kBase64);
    
    // 1. Treat Buffer as Int16Array (Little Endian)
    const pcm24k = new Int16Array(
      pcm24kBuf.buffer,
      pcm24kBuf.byteOffset,
      pcm24kBuf.length / 2
    );
    
    // 2. Downsample 24kHz to 8kHz (Drop 2 out of 3 samples)
    const pcm8k = new Int16Array(Math.floor(pcm24k.length / 3));
    for (let i = 0; i < pcm8k.length; i++) {
      pcm8k[i] = pcm24k[i * 3];
    }
    
    // 3. Convert PCM (8kHz) to Mu-Law (8kHz)
    const mulawBuf = g711.ulawFromPCM(pcm8k) as Uint8Array;
    
    // 4. Encode to Base64
    return encodeBase64(mulawBuf);
  }

  destroy(): void {}
}

let transcoderInstance: AudioTranscoder | null = null;

export function getAudioTranscoder(): AudioTranscoder {
  if (!transcoderInstance) {
    transcoderInstance = new AudioTranscoder();
    logger.info("Audio transcoder inicializado (Pure JS / G711)");
  }
  return transcoderInstance;
}

export function transcodificarTelefoníaAGemini(mulawBase64: string): Promise<Buffer> {
  return getAudioTranscoder().transcodeTelefoniaAGemini(mulawBase64);
}

export function transcodificarGeminiATelefonía(pcm24kBase64: string): Promise<string> {
  return getAudioTranscoder().transcodeGeminiATelefonia(pcm24kBase64);
}