/**
 * Rate Limiter - 100 req/min por IP.
 * Cumple spec sección 14.6.
 */
import type { Request, Response, NextFunction } from "express";

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 100;

const requests = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || "unknown";
  const ahora = Date.now();

  const entry = requests.get(ip);
  if (!entry || entry.resetAt < ahora) {
    requests.set(ip, { count: 1, resetAt: ahora + RATE_LIMIT_WINDOW });
    next();
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    res.status(429).json({
      error: "Rate limit excedido",
      retryAfter: Math.ceil((entry.resetAt - ahora) / 1000),
    });
    return;
  }

  entry.count++;
  next();
}

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, entry] of requests.entries()) {
    if (entry.resetAt < ahora) requests.delete(ip);
  }
}, 5 * 60 * 1000);
