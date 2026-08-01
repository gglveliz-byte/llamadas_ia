/**
 * Servicio de Audio - Ensamblado + subida a Cloudflare R2.
 * Cumple spec sección 7.7.
 *
 * En sandbox: si no hay R2 configurado, guarda en memoria y devuelve data URL.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import g711 from "g711";
import { Readable, Writable } from "stream";

let s3Client: S3Client | null = null;
let s3InitError: Error | null = null;

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";

ffmpeg.setFfmpegPath(FFMPEG_PATH);

function getS3(): S3Client | null {
  if (s3Client) return s3Client;
  if (s3InitError) return null;

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    const err = new Error("R2 credentials not configured: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY required");
    s3InitError = err;
    logger.error({ error: err.message, bucket: process.env.R2_BUCKET_NAME, accountId: process.env.R2_ACCOUNT_ID }, "R2 credentials missing");
    return null;
  }

  try {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
    });
    logger.info({ bucket: process.env.R2_BUCKET_NAME, accountId: process.env.R2_ACCOUNT_ID }, "R2 client initialized");
    return s3Client;
  } catch (e) {
    s3InitError = e as Error;
    logger.error({ error: (e as Error).message, accountId: process.env.R2_ACCOUNT_ID }, "R2 client initialization failed");
    return null;
  }
}

/**
 * Buffers en memoria para los chunks de audio durante una llamada.
 * Canal izq = cliente (inbound), Canal der = IA (outbound).
 */
interface BufferLlamada {
  inbound: Buffer[];
  outbound: Buffer[];
  inicio: number;
}

const buffersActivos = new Map<string, BufferLlamada>();

export function iniciarBufferLlamada(callSid: string): void {
  buffersActivos.set(callSid, {
    inbound: [],
    outbound: [],
    inicio: Date.now(),
  });
}

export function agregarChunkInbound(callSid: string, chunk: Buffer): void {
  const buf = buffersActivos.get(callSid);
  if (buf) buf.inbound.push(chunk);
}

export function agregarChunkOutbound(callSid: string, chunk: Buffer): void {
  const buf = buffersActivos.get(callSid);
  if (buf) buf.outbound.push(chunk);
}

/**
 * Ensambla los buffers inbound + outbound en un WAV estéreo.
 * Canal izq = cliente, Canal der = IA.
 * Cumple spec 7.7.
 */
export async function ensamblarYSubirAudio(
  callSid: string,
  userId: string,
  appointmentId?: string
): Promise<{ url: string; durationSeconds: number } | null> {
  const buf = buffersActivos.get(callSid);
  if (!buf) {
    logger.warn({ callSid }, "No hay buffers de audio para esta llamada");
    return null;
  }

  const inboundBuf = Buffer.concat(buf.inbound);
  const outboundBuf = Buffer.concat(buf.outbound);
  const durationSeconds = Math.round((Date.now() - buf.inicio) / 1000);

  // Ensamblar WAV estéreo con fluent-ffmpeg
  // Canal izq = cliente (inbound, μ-law 8kHz), Canal der = IA (outbound, μ-law 8kHz)
  const wavBuffer = await ensamblarEstereoFFmpeg(inboundBuf, outboundBuf);

  // Subir a R2 (o guardar como data URL en sandbox)
  const s3 = getS3();
  const bucket = process.env.R2_BUCKET_NAME || "grabaciones";
  const key = `${userId}/${callSid}.wav`;
  let url: string;

  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: wavBuffer,
        ContentType: "audio/wav",
      })
    );
    // R2 public URL format: https://<account-id>.r2.cloudflarestorage.com/<bucket>/<key>
    const accountId = process.env.R2_ACCOUNT_ID;
    if (accountId) {
      url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
    } else {
      url = `https://${bucket}.r2.cloudflarestorage.com/${key}`;
    }
    logger.info({ callSid, url, size: wavBuffer.length }, "Grabación subida a R2");
  } else {
    // Bloquear degradación silenciosa en producción: nunca guardar grabaciones en memoria
    if (process.env.NODE_ENV === "production") {
      throw new Error("R2 no configurado en producción - no se puede guardar la grabación");
    }
    // Sandbox (dev): guardar como data URL
    url = `data:audio/wav;base64,${wavBuffer.toString("base64").slice(0, 100)}...`;
    logger.info(
      { callSid, size: wavBuffer.length },
      "[R2 no configurado] Grabación ensamblada (sandbox)"
    );
  }

  // Guardar en DB
  await db.callRecording.create({
    data: {
      userId,
      appointmentId,
      telnyxCallControlId: callSid,
      r2FileUrl: url,
      durationSeconds,
    },
  });

  // Limpiar buffer
  buffersActivos.delete(callSid);

  return { url, durationSeconds };
}

/**
 * Genera URL firmada para reproducción (expira 1h).
 * Cumple spec 7.7.
 */
export async function generarUrlFirmada(fileUrl: string): Promise<string> {
  const s3 = getS3();
  if (!s3 || !fileUrl.includes("r2.cloudflarestorage.com")) {
    return fileUrl; // Devolver tal cual si no es R2
  }

  const bucket = process.env.R2_BUCKET_NAME || "grabaciones";
  // Extraer key de la URL R2: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
  const urlParts = fileUrl.split("r2.cloudflarestorage.com/");
  if (urlParts.length < 2) return fileUrl;
  const pathAfterDomain = urlParts[1];
  const key = pathAfterDomain.startsWith(`${bucket}/`) 
    ? pathAfterDomain.substring(bucket.length + 1) 
    : pathAfterDomain;

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(s3, command, { expiresIn: 3600 });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error generando URL firmada");
    return fileUrl;
  }
}

/**
 * Ensambla dos buffers μ-law mono en un WAV estéreo PCM 16-bit usando fluent-ffmpeg.
 * Canal izq = cliente, canal der = IA.
 * Output: WAV estéreo 16-bit PCM 8kHz.
 */
function ensamblarEstereoFFmpeg(inbound: Buffer, outbound: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Headers WAV temporales μ-law 8kHz mono para cada canal
    const headerMono = (dataLen: number) => {
      const h = Buffer.alloc(44);
      h.write("RIFF", 0);
      h.writeUInt32LE(36 + dataLen, 4);
      h.write("WAVE", 8);
      h.write("fmt ", 12);
      h.writeUInt32LE(16, 16);
      h.writeUInt16LE(7, 20); // μ-law
      h.writeUInt16LE(1, 22); // mono
      h.writeUInt32LE(8000, 24);
      h.writeUInt32LE(8000, 28);
      h.writeUInt16LE(1, 32);
      h.writeUInt16LE(8, 34);
      h.write("data", 36);
      h.writeUInt32LE(dataLen, 40);
      return h;
    };

    const leftWav = Buffer.concat([headerMono(inbound.length), inbound]);
    const rightWav = Buffer.concat([headerMono(outbound.length), outbound]);

    const leftStream = Readable.from(leftWav);
    const rightStream = Readable.from(rightWav);

    const chunks: Buffer[] = [];
    const ffmpegCmd = ffmpeg()
      .input(leftStream)
      .inputFormat("wav")
      .input(rightStream)
      .inputFormat("wav")
      // Output: PCM 16-bit little-endian, 8kHz, stereo
      .audioCodec("pcm_s16le")
      .audioFrequency(8000)
      .audioChannels(2)
      // Merge mono inputs into stereo: left=input0, right=input1
      .outputOptions([
        "-filter_complex",
        "[0:a]pan=mono|c0=c0[left];[1:a]pan=mono|c0=c0[right];[left][right]amerge=inputs=2[aout]",
        "-map", "[aout]",
        "-ac", "2"
      ])
      .format("wav")
      .on("error", (err) => {
        logger.warn({ error: err.message }, "ffmpeg stereo assembly falló, usando fallback");
        // Fallback: interleaving manual μ-law -> PCM16 estéreo
        const maxLen = Math.max(inbound.length, outbound.length);
        const stereoMulaw = Buffer.alloc(maxLen * 2);
        for (let i = 0; i < maxLen; i++) {
          stereoMulaw[i * 2] = inbound[i] ?? 0;
          stereoMulaw[i * 2 + 1] = outbound[i] ?? 0;
        }
        // Convertir μ-law estéreo a PCM16 estéreo
        const pcm16 = Buffer.alloc(stereoMulaw.length * 2);
        const mulawSamples = new Uint8Array(stereoMulaw);
        for (let i = 0; i < mulawSamples.length; i++) {
          const pcm = g711.ulawToPCM(Buffer.from([mulawSamples[i]]))[0];
          pcm16.writeInt16LE(pcm, i * 2);
        }
        const fbHeader = Buffer.alloc(44);
        fbHeader.write("RIFF", 0);
        fbHeader.writeUInt32LE(36 + pcm16.length, 4);
        fbHeader.write("WAVE", 8);
        fbHeader.write("fmt ", 12);
        fbHeader.writeUInt32LE(16, 16);
        fbHeader.writeUInt16LE(1, 20); // PCM
        fbHeader.writeUInt16LE(2, 22); // stereo
        fbHeader.writeUInt32LE(8000, 24);
        fbHeader.writeUInt32LE(32000, 28); // byteRate = 8000 * 2 * 2
        fbHeader.writeUInt16LE(4, 32); // blockAlign = 2 channels * 2 bytes
        fbHeader.writeUInt16LE(16, 34); // bitsPerSample
        fbHeader.write("data", 36);
        fbHeader.writeUInt32LE(pcm16.length, 40);
        resolve(Buffer.concat([fbHeader, pcm16]));
      })
      .on("end", () => resolve(Buffer.concat(chunks)))
      .pipe()
      .on("data", (chunk: Buffer) => chunks.push(chunk));
  });
}
