import { logger } from "./logger";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";
import { spawnSync } from "child_process";
import g711 from "g711";
import ffmpegStatic from "ffmpeg-static";

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";

ffmpeg.setFfmpegPath(FFMPEG_PATH);

export function verificarFfmpegDisponible(): { disponible: boolean; path: string } {
  try {
    const res = spawnSync(FFMPEG_PATH, ["-version"], { encoding: "utf8" });
    return { disponible: res.status === 0, path: FFMPEG_PATH };
  } catch {
    return { disponible: false, path: FFMPEG_PATH };
  }
}

function decodeBase64(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

function encodeBase64(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}

function bufferToStream(buf: Buffer): PassThrough {
  const stream = new PassThrough();
  stream.end(buf);
  return stream;
}

function runFfmpeg(args: string[], input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = bufferToStream(input);
    const proc = ffmpeg(inputStream)
      .inputFormat("mulaw")
      .audioFrequency(8000)
      .audioChannels(1)
      .outputOptions(args)
      .format("s16le")
      .on("error", (err) => reject(err))
      .pipe();

    const chunks: Buffer[] = [];
    proc.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.on("end", () => resolve(Buffer.concat(chunks)));
    proc.on("error", reject);
  });
}

function runFfmpegPcm24kToMulaw(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = bufferToStream(input);
    const proc = ffmpeg(inputStream)
      .inputFormat("s16le")
      .audioFrequency(24000)
      .audioChannels(1)
      .outputOptions(["-f", "mulaw", "-ar", "8000", "-ac", "1"])
      .on("error", (err) => reject(err))
      .pipe();

    const chunks: Buffer[] = [];
    proc.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.on("end", () => resolve(Buffer.concat(chunks)));
    proc.on("error", reject);
  });
}

export class AudioTranscoder {
  async transcodeTelefoniaAGemini(mulawBase64: string): Promise<Buffer> {
    const mulawBuf = decodeBase64(mulawBase64);
    const pcm16k = await runFfmpeg(
      ["-f", "s16le", "-ar", "16000", "-ac", "1", "-af", "aresample=16000:resampler=soxr:precision=28"],
      mulawBuf
    );
    return pcm16k;
  }

  async transcodeGeminiATelefonia(pcm24kBase64: string): Promise<string> {
    const pcm24kBuf = decodeBase64(pcm24kBase64);
    const mulawBuf = await runFfmpegPcm24kToMulaw(pcm24kBuf);
    return encodeBase64(mulawBuf);
  }

  destroy(): void {
  }
}

let transcoderInstance: AudioTranscoder | null = null;

export function getAudioTranscoder(): AudioTranscoder {
  if (!transcoderInstance) {
    transcoderInstance = new AudioTranscoder();
    logger.info("Audio transcoder inicializado (ffmpeg + soxr resampling)");
  }
  return transcoderInstance;
}

export function transcodificarTelefoníaAGemini(mulawBase64: string): Promise<Buffer> {
  return getAudioTranscoder().transcodeTelefoniaAGemini(mulawBase64);
}

export function transcodificarGeminiATelefonía(pcm24kBase64: string): Promise<string> {
  return getAudioTranscoder().transcodeGeminiATelefonia(pcm24kBase64);
}