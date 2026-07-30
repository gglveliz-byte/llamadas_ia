/**
 * Servicio de Cache - En sandbox usa memoria (Map), en prod Redis.
 * Cumple spec sección 16 (invalidación) y caché general.
 */
import { logger } from "../utils/logger";

let redisClient: import("ioredis").default | null = null;
const memoryCache = new Map<string, { valor: string; expira: number }>();

async function getRedis() {
  if (redisClient) return redisClient;
  if (!process.env.REDIS_URL) return null;
  try {
    const Redis = (await import("ioredis")).default;
    redisClient = new Redis(process.env.REDIS_URL);
    logger.info("Redis conectado");
    return redisClient;
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Redis no disponible - usando memory cache");
    return null;
  }
}

export async function cacheGet<T>(clave: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis) {
    const valor = await redis.get(clave);
    return valor ? JSON.parse(valor) : null;
  }
  const cached = memoryCache.get(clave);
  if (!cached || cached.expira < Date.now()) {
    memoryCache.delete(clave);
    return null;
  }
  return JSON.parse(cached.valor);
}

export async function cacheSet<T>(clave: string, valor: T, ttlSegundos: number = 60): Promise<void> {
  const redis = await getRedis();
  const str = JSON.stringify(valor);
  if (redis) {
    await redis.setex(clave, ttlSegundos, str);
    return;
  }
  memoryCache.set(clave, { valor: str, expira: Date.now() + ttlSegundos * 1000 });
}

export async function cacheDel(clave: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.del(clave);
    return;
  }
  memoryCache.delete(clave);
}

export async function cacheDelPattern(patron: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    const claves = await redis.keys(patron);
    if (claves.length > 0) await redis.del(...claves);
    return;
  }
  // Memory: eliminar claves que matcheen el patrón (simple)
  const regex = new RegExp(patron.replace(/\*/g, ".*"));
  for (const clave of memoryCache.keys()) {
    if (regex.test(clave)) memoryCache.delete(clave);
  }
}
