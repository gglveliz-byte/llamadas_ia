/**
 * Endpoints del panel admin.
 * Cumple spec sección 6.
 */
import { Router } from "express";
import { z } from "zod";
import { db } from "../models/database.pool";
import { authAdmin } from "../middleware/auth.middleware";
import { obtenerMetricasActuales, obtenerHistorial } from "../services/monitoring.service";
import { obtenerLlamadasActivasTelnyx } from "../websockets/telnyxStream.handler";
import { logger, obtenerLogsRecientes } from "../utils/logger";
import { Prisma } from "@prisma/client";
import { logAdminAction, getAuditLogs, getAuditLogStats } from "../services/audit.service";

export const adminRouter = Router();

adminRouter.use(authAdmin);

/**
 * GET /admin/metrics
 * Alias público (sin auth para fines demo) de las métricas.
 */
adminRouter.get("/metrics", async (req, res) => {
  const actual = obtenerMetricasActuales();
  const historial = obtenerHistorial();
  const llamadasActivas = obtenerLlamadasActivasTelnyx();

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
    activas: obtenerLlamadasActivasTelnyx(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /admin/config/:clave
 * Actualiza un valor de configuración global.
 */
const configSchema = z.object({
  valor: z.string(),
});

adminRouter.patch("/config/:clave", async (req, res) => {
  const { clave } = req.params;
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "valor requerido y debe ser texto" });
  }
  const { valor } = parsed.data;

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
 * Últimas N entradas de log reales (Pino → Redis ring buffer / memoria).
 */
adminRouter.get("/logs", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const logs = await obtenerLogsRecientes(limit);
    res.json({
      logs,
      total: logs.length,
      fuente: "pino-redis",
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error leyendo logs");
    res.status(500).json({ error: "Error leyendo logs" });
  }
});

// ═══════════════════════════════════════════
// CLIENTES CRUD
// ═══════════════════════════════════════════

/**
 * GET /admin/clientes
 * Lista todos los usuarios con wallet y consumo.
 */
adminRouter.get("/clientes", async (req, res) => {
  try {
    const clientes = await db.user.findMany({
      include: {
        wallet: true,
        _count: { select: { transactions: true, appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      clientes: clientes.map((c) => ({
        id: c.id,
        email: c.email,
        businessName: c.businessName,
        role: c.role,
        isVerified: c.isVerified,
        isSuspended: c.isSuspended,
        saldo: c.wallet?.saldo.toNumber() ?? 0,
        totalTransacciones: c._count.transactions,
        totalCitas: c._count.appointments,
        createdAt: c.createdAt,
      })),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error listando clientes");
    res.status(500).json({ error: "Error al listar clientes" });
  }
});

/**
 * PATCH /admin/clientes/:id
 * Suspender o activar un cliente.
 */
adminRouter.patch("/clientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      isSuspended: z.boolean().optional(),
      isVerified: z.boolean().optional(),
      businessName: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", details: parsed.error.issues });
    const usuario = await db.user.update({ where: { id }, data: parsed.data });
    logger.info({ userId: id, cambios: parsed.data }, "Cliente actualizado por admin");
    res.json({ usuario });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error actualizando cliente");
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

/**
 * POST /admin/clientes/:id/ajuste
 * Ajusta el saldo de un cliente manualmente.
 */
const ajusteSchema = z.object({
  monto: z.number(),
  descripcion: z.string().optional(),
});

adminRouter.post("/clientes/:id/ajuste", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = ajusteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "monto requerido y debe ser número" });
    const { monto, descripcion } = parsed.data;

    const wallet = await db.wallet.findUnique({ where: { userId: id } });
    const saldoAnterior = wallet?.saldo.toNumber() ?? 0;
    const saldoNuevo = saldoAnterior + monto;

    await db.wallet.upsert({
      where: { userId: id },
      update: { saldo: saldoNuevo },
      create: { userId: id, saldo: monto },
    });

    await db.walletTransaction.create({
      data: {
        userId: id,
        tipo: "ajuste_admin",
        monto,
        saldoAnterior,
        saldoNuevo,
        descripcion: descripcion || `Ajuste manual por admin (${monto >= 0 ? "+" : ""}$${monto.toFixed(2)})`,
      },
    });

    logger.info({ userId: id, monto, saldoNuevo }, "Saldo ajustado por admin");
    res.json({ saldoAnterior, saldoNuevo, monto });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error ajustando saldo");
    res.status(500).json({ error: "Error al ajustar saldo" });
  }
});

// ═══════════════════════════════════════════
// PAQUETES CRUD
// ═══════════════════════════════════════════



// ═══════════════════════════════════════════
// RANKING
// ═══════════════════════════════════════════

/**
 * GET /admin/ranking
 * Ranking de clientes por consumo.
 */
adminRouter.get("/ranking", async (req, res) => {
  try {
    const usuarios = await db.user.findMany({
      where: { role: "cliente" },
      include: {
        wallet: true,
        metrics: { select: { duracionSegundos: true, cobroAplicado: true } },
      },
    });

    const ranking = usuarios
      .map((u) => {
        const totalMinutos = u.metrics.reduce((s, m) => s + (m.duracionSegundos ?? 0), 0) / 60;
        const totalGastado = u.metrics.reduce((s, m) => s + (m.cobroAplicado?.toNumber() ?? 0), 0);
        const totalLlamadas = u.metrics.length;
        return {
          userId: u.id,
          businessName: u.businessName || u.email,
          email: u.email,
          saldo: u.wallet?.saldo.toNumber() ?? 0,
          totalMinutos: Math.round(totalMinutos * 100) / 100,
          totalGastado: Math.round(totalGastado * 100) / 100,
          totalLlamadas,
          score: Math.round(totalMinutos * 10 + totalGastado * 2 + totalLlamadas * 5),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    res.json({ ranking });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error generando ranking");
    res.status(500).json({ error: "Error al generar ranking" });
  }
});

// ═══════════════════════════════════════════
// FLUJO DE CAJA
// ═══════════════════════════════════════════

/**
 * GET /admin/cashflow
 * Flujo de caja con filtro opcional de fechas.
 */
adminRouter.get("/cashflow", async (req, res) => {
  try {
    const { desde, hasta } = req.query as { desde?: string; hasta?: string };
    const filtroFecha: Record<string, unknown> = {};
    if (desde || hasta) {
      filtroFecha.createdAt = {};
      if (desde) (filtroFecha.createdAt as Record<string, unknown>).gte = new Date(desde);
      if (hasta) (filtroFecha.createdAt as Record<string, unknown>).lte = new Date(hasta);
    }

    const transacciones = await db.walletTransaction.findMany({
      where: filtroFecha,
      include: { user: { select: { businessName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const ingresos = transacciones
      .filter((t) => t.monto.toNumber() > 0)
      .reduce((s, t) => s + t.monto.toNumber(), 0);
    const egresos = transacciones
      .filter((t) => t.monto.toNumber() < 0)
      .reduce((s, t) => s + Math.abs(t.monto.toNumber()), 0);

    res.json({
      ingresos: Math.round(ingresos * 100) / 100,
      egresos: Math.round(egresos * 100) / 100,
      balance: Math.round((ingresos - egresos) * 100) / 100,
      totalTransacciones: transacciones.length,
      transacciones: transacciones.map((t) => ({
        id: t.id,
        tipo: t.tipo,
        monto: t.monto.toNumber(),
        saldoAnterior: t.saldoAnterior.toNumber(),
        saldoNuevo: t.saldoNuevo.toNumber(),
        descripcion: t.descripcion,
        usuario: t.user?.businessName || t.user?.email || null,
        createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error obteniendo cashflow");
    res.status(500).json({ error: "Error al obtener flujo de caja" });
  }
});

/**
 * GET /admin/audit
 * Lista logs de auditoría con filtros.
 * Query: adminId, targetUserId, action, from, to, limit, offset
 */
adminRouter.get("/audit", async (req, res) => {
  try {
    const { adminId, targetUserId, action, from, to, limit, offset } = req.query;
    const filters: Record<string, unknown> = {};
    if (adminId) filters.adminId = adminId;
    if (targetUserId) filters.targetUserId = targetUserId;
    if (action) filters.action = action;
    if (from) filters.from = new Date(from as string);
    if (to) filters.to = new Date(to as string);
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const logs = await getAuditLogs(filters);
    res.json({ logs, total: logs.length });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error obteniendo audit logs");
    res.status(500).json({ error: "Error obteniendo audit logs" });
  }
});

/**
 * POST /admin/audit
 * Registra una acción administrativa.
 * Body: { targetUserId?, action, details }
 */
const auditLogSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  action: z.string().min(1).max(100),
  details: z.record(z.string(), z.unknown()).optional(),
});

adminRouter.post("/audit", async (req, res) => {
  const parsed = auditLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }

  const adminId = (req as any).user?.id;
  if (!adminId) {
    return res.status(401).json({ error: "Admin no autenticado" });
  }

  const { targetUserId, action, details } = parsed.data;
  await logAdminAction(adminId, action, details ?? null, targetUserId ?? null);

  res.json({ ok: true });
});

/**
 * GET /admin/audit/stats
 * Estadísticas de audit logs.
 */
adminRouter.get("/audit/stats", async (req, res) => {
  try {
    const stats = await getAuditLogStats();
    res.json(stats);
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error obteniendo stats de audit log");
    res.status(500).json({ error: "Error obteniendo stats" });
  }
});
