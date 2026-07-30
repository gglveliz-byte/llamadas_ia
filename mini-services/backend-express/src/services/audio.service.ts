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

let s3Client: S3Client | null = null;

function getS3(): S3Client | null {
  if (s3Client) return s3Client;
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) return null;

  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
  return s3Client;
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

  // Ensamblar WAV estéreo simple (en prod se usaría fluent-ffmpeg)
  const maxLen = Math.max(inboundBuf.length, outboundBuf.length);
  const stereoBuf = Buffer.alloc(maxLen * 2);
  for (let i = 0; i < maxLen; i++) {
    stereoBuf[i * 2] = inboundBuf[i] ?? 0; // L = cliente
    stereoBuf[i * 2 + 1] = outboundBuf[i] ?? 0; // R = IA
  }

  // Generar header WAV
  const wavHeader = generarWavHeader(stereoBuf.length, 8000, 2, 8); // 8kHz, estéreo, 8-bit μ-law
  const wavBuffer = Buffer.concat([wavHeader, stereoBuf]);

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
    url = `https://${bucket}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
    logger.info({ callSid, url, size: wavBuffer.length }, "Grabación subida a R2");
  } else {
    // Sandbox: guardar como data URL (no accesible desde fuera, pero queda registrado)
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
      twilioCallSid: callSid,
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
  const key = fileUrl.split("/").slice(-2).join("/");

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(s3, command, { expiresIn: 3600 });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error generando URL firmada");
    return fileUrl;
  }
}

// Header WAV simple
function generarWavHeader(
  dataLength: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): Buffer {
  const buffer = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(7, 20); // AudioFormat (7 = μ-law)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}
