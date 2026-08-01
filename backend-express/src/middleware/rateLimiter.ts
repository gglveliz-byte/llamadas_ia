/**
 * Rate Limiter - 100 req/min por IP usando Redis (con fallback a memoria).
 * Cumple spec sección 14.6.
 */
import type { Request, Response, NextFunction } from "express";
import { getRedis } from "../services/cache.service";

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 100;

const memoryStore = new Map<string, { count: number; resetAt: number }>();

async function getStore() {
  const redis = await getRedis();
  return redis;
}

function getMemoryEntry(ip: string, ahora: number) {
  const entry = memoryStore.get(ip);
  if (!entry || entry.resetAt < ahora) {
    return { count: 1, resetAt: ahora + RATE_LIMIT_WINDOW };
  }
  return entry;
}

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || "unknown";
  const ahora = Date.now();

  const redis = await getStore();
  if (redis) {
    const key = `ratelimit:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, RATE_LIMIT_WINDOW);
    }
    if (current > RATE_LIMIT_MAX) {
      const ttl = await redis.pttl(key);
      res.status(429).json({
        error: "Rate limit excedido",
        retryAfter: Math.ceil(ttl / 1000),
      });
      return;
    }
    next();
    return;
  }

  // Fallback memoria
  const entry = getMemoryEntry(ip, ahora);
  if (entry.count >= RATE_LIMIT_MAX) {
    res.status(429).json({
      error: "Rate limit excedido",
      retryAfter: Math.ceil((entry.resetAt - ahora) / 1000),
    });
    return;
  }
  entry.count++;
  memoryStore.set(ip, entry);
  next();
}

// Limpiar entradas expiradas memoria cada 5 minutos
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, entry] of memoryStore.entries()) {
    if (entry.resetAt < ahora) memoryStore.delete(ip);
  }
}, 5 * 60 * 1000);