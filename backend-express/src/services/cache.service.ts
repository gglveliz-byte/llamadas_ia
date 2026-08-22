/**
 * Servicio de Cache - En sandbox usa memoria (Map), en prod Redis.
 * Cumple spec sección 16 (invalidación) y caché general.
 */
import { logger } from "../utils/logger";

let redisClient: import("ioredis").default | null = null;
let redisFallbackHasta = 0;
const memoryCache = new Map<string, { valor: string; expira: number }>();

export async function getRedis() {
  if (redisClient) return redisClient;
  if (Date.now() < redisFallbackHasta) return null;
  if (!process.env.REDIS_URL) return null;
  try {
    const Redis = (await import("ioredis")).default;
    let url = process.env.REDIS_URL;
    
    // Upstash siempre requiere TLS. Si el usuario pegó redis:// por error, lo auto-corregimos.
    if (url.includes("upstash.io") && url.startsWith("redis://")) {
      url = url.replace("redis://", "rediss://");
    }

    const isTls = url.startsWith("rediss://");
    const client = new Redis(url, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableOfflineQueue: false,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    });
    client.on("error", () => {
      // Evitar eventos error sin handler
    });
    // Esperar conexión con timeout garantizado (evita que cada request cuelgue
    // si Redis no está disponible: con retryStrategy null ioredis emite "end" sin "error").
    const conectado = await new Promise<boolean>((resolve) => {
      let done = false;
      const fin = (ok: boolean) => {
        if (!done) {
          done = true;
          resolve(ok);
        }
      };
      client.once("ready", () => fin(true));
      client.once("error", (err) => {
        logger.warn({ err }, "Error inicial conectando a Redis");
        fin(false);
      });
      setTimeout(() => {
        logger.warn("Timeout de 3000ms esperando a Redis");
        fin(false);
      }, 3000);
    });
    if (conectado) {
      redisClient = client;
      client.on("end", () => {
        if (redisClient === client) {
          redisClient = null;
          logger.warn("Redis conexión cerrada - estado reseteado para reconectar");
        }
      });
      logger.info("Redis conectado exitosamente");
      return redisClient;
    }
    client.disconnect();
    // Cooldown: no reintentar conexión en cada request durante 5 minutos
    redisFallbackHasta = Date.now() + 300000;
    logger.warn("Redis no disponible - usando memory cache");
    return null;
  } catch (e) {
    redisFallbackHasta = Date.now() + 30000;
    logger.warn({ error: (e as Error).message }, "Redis no disponible - usando memory cache");
    return null;
  }
}

export async function cacheGet<T>(clave: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis && redis.status === "ready") {
    try {
      const valor = await redis.get(clave);
      return valor ? JSON.parse(valor) : null;
    } catch (error) {
      logger.warn({ error }, "Error en cacheGet, usando memory cache");
    }
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
  if (redis && redis.status === "ready") {
    try {
      await redis.setex(clave, ttlSegundos, str);
      return;
    } catch (error) {
      logger.warn({ error }, "Error en cacheSet, usando memory cache");
    }
  }
  memoryCache.set(clave, { valor: str, expira: Date.now() + ttlSegundos * 1000 });
}

export async function cacheDel(clave: string): Promise<void> {
  const redis = await getRedis();
  if (redis && redis.status === "ready") {
    try {
      await redis.del(clave);
      return;
    } catch (error) {
      logger.warn({ error }, "Error en cacheDel, usando memory cache");
    }
  }
  memoryCache.delete(clave);
}

export async function cacheDelPattern(patron: string): Promise<void> {
  const redis = await getRedis();
  if (redis && redis.status === "ready") {
    try {
      const claves = await redis.keys(patron);
      if (claves.length > 0) await redis.del(...claves);
      return;
    } catch (error) {
      logger.warn({ error }, "Error en cacheDelPattern, usando memory cache");
    }
  }
  // Memory: eliminar claves que matcheen el patrón (simple)
  const regex = new RegExp(patron.replace(/\*/g, ".*"));
  for (const clave of memoryCache.keys()) {
    if (regex.test(clave)) memoryCache.delete(clave);
  }
}
