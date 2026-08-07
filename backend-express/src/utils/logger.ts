/**
 * Logger Pino - JSON en producción, pretty en dev.
 * Multi-stream: salida estándar + ring buffer (Redis en prod, memoria en sandbox)
 * para que /admin/logs lea logs reales de la aplicación.
 * Cumple spec sección 13.1.
 */
import pino from "pino";
import { Writable } from "stream";
import { getRedis } from "../services/cache.service";

const isDev = process.env.NODE_ENV !== "production";

const CLAVE_LOGS = "logs:recent";
const MAX_LOGS = 1000;

// Ring buffer en memoria (fallback cuando Redis no está disponible)
const ringBuffer: string[] = [];

function crearStreamLogs(): Writable {
  return new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      try {
        const linea = chunk.toString();
        ringBuffer.push(linea);
        if (ringBuffer.length > MAX_LOGS) ringBuffer.shift();
        getRedis()
          .then((redis) => {
            if (!redis) return;
            return redis
              .lpush(CLAVE_LOGS, linea)
              .then(() => redis.ltrim(CLAVE_LOGS, 0, MAX_LOGS - 1))
              .catch(() => {});
          })
          .catch(() => {});
      } catch {}
      cb();
    },
  });
}

const streams = [{ stream: crearStreamLogs() }];
if (isDev) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pretty = require("pino-pretty")({
    colorize: true,
    translateTime: "SYS:HH:MM:ss.l",
    ignore: "pid,hostname",
  });
  streams.unshift({ stream: pretty });
} else {
  // En producción, también escribir a process.stdout para que Render los capture
  streams.unshift({ stream: process.stdout });
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
  },
  pino.multistream(streams)
);

/**
 * Lee las últimas N entradas de log (fuente real: Redis ring buffer o memoria).
 * Devuelve entradas ordenadas de más antigua a más reciente.
 */
export async function obtenerLogsRecientes(limit: number = 50): Promise<Array<Record<string, unknown>>> {
  const redis = await getRedis();
  if (redis) {
    try {
      const items = await redis.lrange(CLAVE_LOGS, 0, limit - 1);
      if (items.length > 0) {
        return items.map((i) => JSON.parse(i)).reverse();
      }
    } catch {}
  }
  return ringBuffer.slice(-limit).map((i) => JSON.parse(i));
}

/**
 * Crea un child logger con contexto de llamada.
 * Uso: const callLogger = logger.child({ callSid, userId, streamSid });
 */
export function createCallLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export type CallLogger = ReturnType<typeof logger.child>;
