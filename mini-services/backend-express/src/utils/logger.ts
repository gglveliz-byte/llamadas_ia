/**
 * Logger Pino - JSON en producción, pretty en dev.
 * Cumple spec sección 13.1.
 */
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

/**
 * Crea un child logger con contexto de llamada.
 * Uso: const callLogger = logger.child({ callSid, userId, streamSid });
 */
export function createCallLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export type CallLogger = ReturnType<typeof logger.child>;
