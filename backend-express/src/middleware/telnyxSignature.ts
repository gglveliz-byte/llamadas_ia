/**
 * Middleware de validación de firma Telnyx (Ed25519).
 * Telnyx usa Ed25519 para firmar webhooks.
 * Header: Telnyx-Signature-Ed25519: timestamp,signature
 * 
 * Verificación: signature = Ed25519.sign(privateKey, timestamp + "|" + body)
 * Verificamos: Ed25519.verify(publicKey, timestamp + "|" + body, signature)
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../utils/logger";

const PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY!;

export interface TelnyxSignatureParts {
  timestamp: string;
  signature: string;
}

function parseTelnyxSignature(header: string): TelnyxSignatureParts | null {
  // Formato: "timestamp,signature" o "t=timestamp,s=signature"
  const parts = header.split(",");
  if (parts.length !== 2) return null;

  const timestamp = parts[0].trim();
  const signature = parts[1].trim();

  if (!timestamp || !signature) return null;

  return { timestamp, signature };
}

function verifyEd25519(publicKeyPem: string, message: string, signatureB64: string): boolean {
  try {
    // Convertir PEM a clave pública crypto
    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: "pem",
      type: "spki",
    });

    const signature = Buffer.from(signatureB64, "base64");
    const messageBuffer = Buffer.from(message, "utf8");

    // Ed25519 usa digest null (one-shot API). createVerify("ed25519") lanza
    // "Invalid digest" en Node >= 22.
    return crypto.verify(null, messageBuffer, publicKey, signature);
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error verificando firma Ed25519");
    return false;
  }
}

export function validarFirmaTelnyx(req: Request, res: Response, next: NextFunction): void {
  const signatureHeader = req.headers["telnyx-signature-ed25519"] as string | undefined;

  if (!signatureHeader) {
    logger.warn("Webhook Telnyx sin header Telnyx-Signature-Ed25519");
    res.status(401).json({ error: "Firma requerida" });
    return;
  }

  const parsed = parseTelnyxSignature(signatureHeader);
  if (!parsed) {
    logger.warn({ header: signatureHeader }, "Formato de firma Telnyx inválido");
    res.status(401).json({ error: "Formato de firma inválido" });
    return;
  }

  const { timestamp, signature } = parsed;

  // Verificar timestamp (prevenir replay attacks - max 5 min)
  const now = Math.floor(Date.now() / 1000);
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum) || Math.abs(now - timestampNum) > 300) {
    logger.warn({ timestamp, now }, "Timestamp de firma Telnyx fuera de rango");
    res.status(401).json({ error: "Timestamp inválido" });
    return;
  }

  // Construir mensaje: timestamp + "|" + body
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const message = `${timestamp}|${body}`;

  if (!verifyEd25519(PUBLIC_KEY, message, signature)) {
    logger.warn({ timestamp }, "Firma Telnyx inválida");
    res.status(401).json({ error: "Firma inválida" });
    return;
  }

  // Firma válida
  next();
}

export function validarFirmaTelnyxCallControl(req: Request, res: Response, next: NextFunction): void {
  // Para Call Control API webhooks (call.initiated, call.answered, etc.)
  // Mismo header Telnyx-Signature-Ed25519
  return validarFirmaTelnyx(req, res, next);
}