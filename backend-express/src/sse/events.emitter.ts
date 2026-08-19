/**
 * SSE (Server-Sent Events) para tiempo real.
 * Cumple spec sección 12.1.
 *
 * Endpoint: GET /sse/events?user_id=...&token=...
 * Eventos: nueva_cita, llamada_finalizada, saldo_bajo, transcripcion, alerta_sistema
 */
import type { Response } from "express";
import { logger } from "../utils/logger";

interface ClienteSSE {
  userId: string;
  res: Response;
  conectadoEn: number;
}

const clientes = new Map<string, Set<ClienteSSE>>();

export function registrarClienteSSE(userId: string, res: Response): ClienteSSE {
  const cliente: ClienteSSE = { userId, res, conectadoEn: Date.now() };

  if (!clientes.has(userId)) {
    clientes.set(userId, new Set());
  }
  clientes.get(userId)!.add(cliente);

  logger.debug({ userId, total: clientes.get(userId)?.size }, "Cliente SSE conectado");
  return cliente;
}

export function removerClienteSSE(cliente: ClienteSSE): void {
  const set = clientes.get(cliente.userId);
  if (set) {
    set.delete(cliente);
    if (set.size === 0) clientes.delete(cliente.userId);
  }
  logger.debug({ userId: cliente.userId }, "Cliente SSE desconectado");
}

export function emitirSSE(
  userId: string,
  evento: string,
  data: unknown
): void {
  const set = clientes.get(userId);
  if (!set || set.size === 0) return;

  const payload = `event: ${evento}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const cliente of set) {
    try {
      cliente.res.write(payload);
    } catch (e) {
      logger.warn({ error: (e as Error).message, userId }, "Error enviando SSE");
      removerClienteSSE(cliente);
    }
  }
}

export function emitirSSEAdmin(evento: string, data: unknown): void {
  // Emitir a todos los admins (userId con rol admin en DB)
  // En sandbox: emitir a todas las conexiones activas para fines demo
  for (const [userId] of clientes.entries()) {
    emitirSSE(userId, evento, data);
  }
}

export function obtenerClientesConectados(): number {
  let total = 0;
  for (const set of clientes.values()) total += set.size;
  return total;
}

/**
 * Configura headers SSE en una Response.
 */
export function configurarSSEHeaders(res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Desactivar buffering nginx
  });
  // Enviar evento inicial
  res.write(": conectado\n\n");
}
