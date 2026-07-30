/**
 * Endpoints del panel admin.
 * Cumple spec sección 6.
 */
import { Router } from "express";
import { db } from "../models/database.pool";
import { authAdmin } from "../middleware/auth.middleware";
import { obtenerMetricasActuales, obtenerHistorial } from "../services/monitoring.service";
import { obtenerLlamadasActivas } from "../websockets/twilioStream.handler";
import { logger } from "../utils/logger";

export const adminRouter = Router();

adminRouter.use(authAdmin);

/**
 * GET /admin/metrics
 * Alias público (sin auth para fines demo) de las métricas.
 */
adminRouter.get("/metrics", async (req, res) => {
  const actual = obtenerMetricasActuales();
  const historial = obtenerHistorial();
  const llamadasActivas = obtenerLlamadasActivas();

  res.json({
    actual: {
      ...actual,
      llamadasActivas,
      ts: new Date(actual.ts).toISOString(),
    },
    historial: historial.map((h) => ({
      ts: new Date(h.ts).toISOString(),
      cpu: h.cpu,
      ram: h.ram,
      latencia: h.latencia,
      llamadas: h.llamadas,
    })),
    fuente: "express-direct",
  });
});

/**
 * GET /admin/llamadas-activas
 * Lista de llamadas en curso.
 */
adminRouter.get("/llamadas-activas", (req, res) => {
  res.json({
    activas: obtenerLlamadasActivas(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /admin/config/:clave
 * Actualiza un valor de configuración global.
 */
adminRouter.patch("/config/:clave", async (req, res) => {
  const { clave } = req.params;
  const { valor } = req.body;

  const config = await db.adminConfig.upsert({
    where: { clave },
    update: { valor },
    create: { clave, valor },
  });

  logger.info({ clave, valor }, "Config admin actualizada vía Express");
  res.json({ config });
});

/**
 * GET /admin/logs
 * Últimas N entradas de log (simulado - en prod vendría de Pino transporte).
 */
adminRouter.get("/logs", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  // En producción, esto leería del transporte de logs (Loki, CloudWatch, etc.)
  res.json({
    logs: [
      {
        ts: new Date().toISOString(),
        level: "info",
        msg: "Express backend activo",
      },
    ],
    note: "En producción, esto leería del sistema de logs centralizado.",
  });
});
