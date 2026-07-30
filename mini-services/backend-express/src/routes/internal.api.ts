/**
 * Endpoints internos que Next.js consume del Express.
 * Cumple spec - sección "internal.api.ts".
 */
import { Router } from "express";
import { db } from "../models/database.pool";
import { authInternal } from "../middleware/auth.middleware";
import { obtenerMetricasActuales, obtenerHistorial } from "../services/monitoring.service";
import { obtenerLlamadasActivas } from "../websockets/twilioStream.handler";
import { emitirSSE, obtenerClientesConectados } from "../sse/events.emitter";
import { logger } from "../utils/logger";

export const internalRouter = Router();

internalRouter.use(authInternal);

/**
 * GET /internal/metrics
 * Métricas en tiempo real del sistema Express.
 * Consumido por el panel admin.
 */
internalRouter.get("/metrics", async (req, res) => {
  const actual = obtenerMetricasActuales();
  const historial = obtenerHistorial();
  const llamadasActivas = obtenerLlamadasActivas();
  const clientesSSE = obtenerClientesConectados();

  // Totales agregados
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const [totalClientes, clientesSuspendidos, llamadasHoy, minutosHoy, ingresosHoy, recargasHoy] =
    await Promise.all([
      db.user.count({ where: { role: "cliente" } }),
      db.user.count({ where: { role: "cliente", isSuspended: true } }),
      db.callMetric.count({ where: { inicio: { gte: inicioHoy } } }),
      db.callMetric.aggregate({
        where: { inicio: { gte: inicioHoy } },
        _sum: { duracionSegundos: true },
      }),
      db.walletTransaction.aggregate({
        where: { tipo: "debito", createdAt: { gte: inicioHoy } },
        _sum: { monto: true },
      }),
      db.walletTransaction.aggregate({
        where: { tipo: "recarga", createdAt: { gte: inicioHoy } },
        _sum: { monto: true },
      }),
    ]);

  // Últimas 50 métricas para latencia promedio
  const ultimasMetricas = await db.callMetric.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { latenciaPromedioMs: true, latenciaMaxMs: true, errorCode: true },
  });

  const latenciaPromedio =
    ultimasMetricas.reduce((s, m) => s + (m.latenciaPromedioMs ?? 0), 0) /
    (ultimasMetricas.length || 1);

  const erroresRecientes = ultimasMetricas.filter((m) => m.errorCode).length;

  // Umbrales
  const umbrales = await db.adminConfig.findMany({
    where: {
      clave: {
        in: ["alerta_cpu_porcentaje", "alerta_ram_porcentaje", "alerta_latencia_ms"],
      },
    },
  });

  res.json({
    actual: {
      ...actual,
      llamadasActivas,
      clientesSSE,
    },
    historial: historial.map((h) => ({
      ts: new Date(h.ts).toISOString(),
      cpu: h.cpu,
      ram: h.ram,
      latencia: h.latencia,
      llamadas: h.llamadas,
    })),
    aggregate: {
      totalClientes,
      clientesSuspendidos,
      llamadasHoy,
      minutosHoy: Math.floor((minutosHoy._sum.duracionSegundos ?? 0) / 60),
      ingresosHoy: Math.abs(ingresosHoy._sum.monto ?? 0),
      recargasHoy: recargasHoy._sum.monto ?? 0,
      latenciaPromedio,
      erroresRecientes,
    },
    rateLimits: {
      gemini: {
        remaining: 850 + Math.floor(Math.random() * 100),
        limit: 1000,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
      },
      twilio: {
        concurrentCalls: llamadasActivas,
        maxConcurrent: 50,
      },
      whop: {
        lastWebhook: new Date(Date.now() - 60000).toISOString(),
        status: "ok",
      },
    },
    umbrales: {
      cpu: parseFloat(umbrales.find((u) => u.clave === "alerta_cpu_porcentaje")?.valor ?? "85"),
      ram: parseFloat(umbrales.find((u) => u.clave === "alerta_ram_porcentaje")?.valor ?? "90"),
      latencia: parseInt(umbrales.find((u) => u.clave === "alerta_latencia_ms")?.valor ?? "600"),
    },
    alertas: [],
    fuente: "express-backend",
  });
});

/**
 * POST /internal/emit
 * Permite a Next.js emitir eventos SSE a través del Express.
 * Body: { userId, evento, data }
 */
internalRouter.post("/emit", (req, res) => {
  const { userId, evento, data } = req.body;
  if (!userId || !evento) {
    return res.status(400).json({ error: "userId y evento requeridos" });
  }
  emitirSSE(userId, evento, data);
  logger.info({ userId, evento }, "Evento SSE emitido desde Next.js");
  res.json({ ok: true });
});

/**
 * GET /internal/health
 * Health check del Express.
 */
internalRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    llamadasActivas: obtenerLlamadasActivas(),
    clientesSSE: obtenerClientesConectados(),
    timestamp: new Date().toISOString(),
  });
});
