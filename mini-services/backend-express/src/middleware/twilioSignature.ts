/**
 * Validación de X-Twilio-Signature.
 * Cumple spec sección 14.1.
 *
 * Twilio firma cada webhook con HMAC-SHA1 usando el AuthToken de la subcuenta.
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../models/database.pool";
import { decrypt } from "../utils/encryption";
import { logger } from "../utils/logger";

export async function validarFirmaTwilio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) {
    res.status(401).json({ error: "X-Twilio-Signature no presente" });
    return;
  }

  // Construir la URL completa
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const fullUrl = `${protocol}://${req.headers.host}${req.originalUrl}`;

  // Obtener el AuthToken de la subcuenta correspondiente
  // Buscar por el número To (que viene en el body)
  const toNumber = req.body?.To;
  if (!toNumber) {
    // Para webhooks de status callback, usar cuenta maestra
    const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN;
    if (masterToken && validarSignature(fullUrl, req.body, signature, masterToken)) {
      next();
      return;
    }
    res.status(401).json({ error: "No se puede validar firma sin número To ni master token" });
    return;
  }

  // Buscar usuario por número
  const phone = await db.phoneNumber.findFirst({
    where: { phoneNumber: toNumber },
    include: { user: true },
  });
  if (!phone?.user) {
    logger.warn({ toNumber }, "Número no encontrado al validar firma Twilio");
    res.status(404).json({ error: "Número no registrado" });
    return;
  }

  // Desencriptar AuthToken
  let authToken: string;
  try {
    authToken = decrypt(phone.user.twilioSubaccountAuthTokenEnc || "");
  } catch {
    // Fallback a master token
    authToken = process.env.TWILIO_MASTER_AUTH_TOKEN || "";
  }

  if (!authToken) {
    res.status(500).json({ error: "No se pudo obtener AuthToken de Twilio" });
    return;
  }

  if (validarSignature(fullUrl, req.body, signature, authToken)) {
    next();
  } else {
    logger.warn({ toNumber, fullUrl }, "Firma Twilio inválida");
    res.status(401).json({ error: "Firma Twilio inválida" });
  }
}

function validarSignature(
  url: string,
  params: Record<string, unknown>,
  signature: string,
  authToken: string
): boolean {
  // Construir string a firmar: URL + params ordenados
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    if (params[key] !== undefined && params[key] !== null) {
      data += key + String(params[key]);
    }
  }

  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  // Comparación time-constant
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
