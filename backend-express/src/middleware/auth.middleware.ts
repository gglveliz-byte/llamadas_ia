/**
 * Middleware de Auth - verificación JWT.
 * Cumple spec sección 14.3.
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface JwtPayload {
  userId: string;
  email: string;
  role: "cliente" | "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token no proporcionado" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "JWT inválido");
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function authAdmin(req: Request, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Acceso denegado - se requiere rol admin" });
      return;
    }
    next();
  });
}

/**
 * Genera JWT para un usuario.
 */
export function generarJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

/**
 * Middleware para rutas internas (Next.js → Express).
 * Acepta x-internal-api-key header.
 * Requiere INTERNAL_API_KEY configurada.
 */
export function authInternal(req: Request, res: Response, next: NextFunction): void {
  const internalKey = req.headers["x-internal-api-key"];
  const expectedKey = process.env.INTERNAL_API_KEY!;

  if (!internalKey || internalKey !== expectedKey) {
    res.status(401).json({ error: "API key inválida" });
    return;
  }
  const userId = req.headers["x-user-id"] as string | undefined;
  req.user = userId
    ? { userId, email: "", role: "cliente" }
    : { userId: "", email: "", role: "cliente" };
  next();
}
