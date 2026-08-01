/**
 * Servicio de Rate Limiting - Tracking real de APIs externas (Gemini, Telnyx).
 * Cumple spec sección 13.3.
 *
 * Usa Redis para persistencia multi-instancia con TTL automático.
 * El cliente Redis se reutiliza de cache.service (conexión acotada y fallback a memoria).
 */
import { logger } from "../utils/logger";
import { getRedis } from "./cache.service";

interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: string; // ISO string
}

const REDIS_KEY_GEMINI = "ratelimit:gemini";
const REDIS_KEY_TELNYX = "ratelimit:telnyx";
const REDIS_KEY_TELNYX_CONCURRENCY = "ratelimit:telnyx:concurrency";

// Fallback en memoria si no hay Redis
const memoriaFallback = {
  gemini: { remaining: 1000, limit: 1000, resetAt: new Date(Date.now() + 3600000).toISOString() },
  telnyx: { remaining: 1000, limit: 1000, resetAt: new Date(Date.now() + 3600000).toISOString() },
  telnyxConcurrency: { current: 0, max: 50 },
};

async function getFromRedis(key: string, fallback: RateLimitInfo): Promise<RateLimitInfo> {
  const redis = await getRedis();
  if (!redis) return fallback;
  try {
    const data = await redis.get(key);
    if (data) return JSON.parse(data);
    return fallback;
  } catch (e) {
    logger.warn({ error: (e as Error).message, key }, "Error leyendo rate limit de Redis, usando memoria");
    return fallback;
  }
}

async function saveToRedis(key: string, data: RateLimitInfo, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (e) {
    logger.error({ error: (e as Error).message, key }, "Error guardando rate limit en Redis");
  }
}

/**
 * Actualiza rate limit de Gemini desde headers HTTP.
 * Headers esperados: x-ratelimit-remaining-requests, x-ratelimit-limit-requests, x-ratelimit-reset-requests
 */
export async function actualizarRateLimitGemini(headers: Record<string, string | undefined>): Promise<void> {
  const remaining = headers["x-ratelimit-remaining-requests"];
  const limit = headers["x-ratelimit-limit-requests"];
  const reset = headers["x-ratelimit-reset-requests"];

  const current = await getFromRedis(REDIS_KEY_GEMINI, memoriaFallback.gemini);

  if (remaining) current.remaining = parseInt(remaining);
  if (limit) current.limit = parseInt(limit);
  if (reset) {
    const resetMs = parseInt(reset);
    // x-ratelimit-reset-requests viene en segundos Unix
    current.resetAt = new Date(resetMs * 1000).toISOString();
  }

  // TTL: hasta reset + 1 hora de margen, máximo 24h
  const ttl = Math.min(Math.max(Math.ceil((new Date(current.resetAt).getTime() - Date.now()) / 1000), 300), 86400);
  await saveToRedis(REDIS_KEY_GEMINI, current, ttl);

  memoriaFallback.gemini = { ...current };
}

export async function obtenerRateLimitGemini(): Promise<RateLimitInfo> {
  return getFromRedis(REDIS_KEY_GEMINI, memoriaFallback.gemini);
}

/**
 * Actualiza rate limit de Telnyx desde headers HTTP.
 * Headers esperados: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 */
export async function actualizarRateLimitTelnyx(headers: Record<string, string | undefined>): Promise<void> {
  const remaining = headers["x-ratelimit-remaining"] || headers["x-ratelimit-remaining-requests"];
  const limit = headers["x-ratelimit-limit"] || headers["x-ratelimit-limit-requests"];
  const reset = headers["x-ratelimit-reset"] || headers["x-ratelimit-reset-requests"];

  const current = await getFromRedis(REDIS_KEY_TELNYX, memoriaFallback.telnyx);

  if (remaining) current.remaining = parseInt(remaining);
  if (limit) current.limit = parseInt(limit);
  if (reset) {
    const resetMs = parseInt(reset);
    // Telnyx usa timestamp Unix en segundos
    current.resetAt = new Date(resetMs * 1000).toISOString();
  }

  const ttl = Math.min(Math.max(Math.ceil((new Date(current.resetAt).getTime() - Date.now()) / 1000), 300), 86400);
  await saveToRedis(REDIS_KEY_TELNYX, current, ttl);

  memoriaFallback.telnyx = { ...current };
}

export async function obtenerRateLimitTelnyx(): Promise<RateLimitInfo> {
  return getFromRedis(REDIS_KEY_TELNYX, memoriaFallback.telnyx);
}

/**
 * Incrementa contador de conexiones Telnyx activas.
 */
export async function incrementarConcurrenciaTelnyx(): Promise<number> {
  const redis = await getRedis();
  if (!redis) {
    memoriaFallback.telnyxConcurrency.current++;
    return memoriaFallback.telnyxConcurrency.current;
  }
  try {
    const current = await redis.incr(REDIS_KEY_TELNYX_CONCURRENCY);
    await redis.expire(REDIS_KEY_TELNYX_CONCURRENCY, 3600); // TTL 1h
    return current;
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Redis incr falló, usando memoria");
    memoriaFallback.telnyxConcurrency.current++;
    return memoriaFallback.telnyxConcurrency.current;
  }
}

/**
 * Decrementa contador de conexiones Telnyx activas.
 */
export async function decrementarConcurrenciaTelnyx(): Promise<number> {
  const redis = await getRedis();
  if (!redis) {
    memoriaFallback.telnyxConcurrency.current = Math.max(0, memoriaFallback.telnyxConcurrency.current - 1);
    return memoriaFallback.telnyxConcurrency.current;
  }
  try {
    const current = await redis.decr(REDIS_KEY_TELNYX_CONCURRENCY);
    if (current < 0) await redis.set(REDIS_KEY_TELNYX_CONCURRENCY, "0");
    return Math.max(0, current);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Redis decr falló, usando memoria");
    memoriaFallback.telnyxConcurrency.current = Math.max(0, memoriaFallback.telnyxConcurrency.current - 1);
    return memoriaFallback.telnyxConcurrency.current;
  }
}

/**
 * Obtiene concurrencia actual de Telnyx.
 */
export async function obtenerConcurrenciaTelnyx(): Promise<{ current: number; max: number }> {
  const redis = await getRedis();
  let current = memoriaFallback.telnyxConcurrency.current;
  if (redis) {
    try {
      const val = await redis.get(REDIS_KEY_TELNYX_CONCURRENCY);
      current = val ? parseInt(val) : 0;
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "Error leyendo concurrencia Telnyx de Redis");
    }
  }
  return { current, max: memoriaFallback.telnyxConcurrency.max };
}

/**
 * Establece límite máximo de concurrencia Telnyx (configurable via admin).
 */
export function setMaxConcurrenciaTelnyx(max: number): void {
  memoriaFallback.telnyxConcurrency.max = max;
}

export { memoriaFallback };