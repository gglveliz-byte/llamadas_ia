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

// ─── COSTOS OPERATIVOS TELNYX ───────────────────────────────────────────────

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;

/** Caché simple en memoria: precios de números por país (TTL 1h). */
const numberPricingCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * GET /admin/telnyx-costs/numbers?countryCode=US
 * Consulta precios REALES de números en Telnyx para un país.
 */
adminRouter.get("/telnyx-costs/numbers", async (req, res) => {
  const countryCode = String(req.query.countryCode || "").toUpperCase();
  if (!countryCode || countryCode.length > 5) {
    return res.status(400).json({ error: "countryCode requerido" });
  }

  try {
    // Revisar caché
    const cached = numberPricingCache.get(countryCode);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    // Consultar Telnyx
    const params = new URLSearchParams({
      "filter[country_code]": countryCode,
      "filter[features][]": "voice",
      "page[size]": "5",
    });

    const telRes = await fetch(`${TELNYX_API_BASE}/available_phone_numbers?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!telRes.ok) {
      const errText = await telRes.text();
      logger.error({ countryCode, status: telRes.status, error: errText }, "Error consultando precios Telnyx");
      return res.status(502).json({ error: `Error Telnyx: ${telRes.status}` });
    }

    const telData: any = await telRes.json();
    const numbers = (telData.data ?? []).map((n: any) => ({
      phoneNumber: n.phone_number,
      region: n.region_information?.[0]?.region_name ?? null,
      upfrontCost: n.cost_information?.upfront_cost ?? null,
      monthlyCost: n.cost_information?.monthly_cost ?? null,
      currency: n.cost_information?.currency ?? "USD",
    }));

    // Obtener margen configurado
    const cfgMargen = await db.adminConfig.findUnique({ where: { clave: "margen_numero_pct" } });
    const margenPct = parseFloat(cfgMargen?.valor ?? "50");

    const result = { countryCode, numbers, margenPct, totalAvailable: telData.meta?.total_results ?? null };

    // Cachear
    numberPricingCache.set(countryCode, { data: result, ts: Date.now() });

    res.json(result);
  } catch (e) {
    logger.error({ error: (e as Error).message, countryCode }, "Error en telnyx-costs/numbers");
    res.status(500).json({ error: "Error consultando precios de números" });
  }
});

/**
 * GET /admin/telnyx-costs/rates
 * Devuelve todas las tarifas por minuto configuradas.
 */
adminRouter.get("/telnyx-costs/rates", async (_req, res) => {
  try {
    const rates = await db.telnyxRate.findMany({
      orderBy: { countryName: "asc" },
    });
    res.json({ rates });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error listando telnyx rates");
    res.status(500).json({ error: "Error listando tarifas" });
  }
});

/**
 * PUT /admin/telnyx-costs/rates/:countryCode
 * Crea o actualiza tarifa por minuto para un país.
 */
const rateSchema = z.object({
  countryName: z.string().min(1).max(100),
  inboundPerMin: z.coerce.number().min(0).max(100),
  outboundPerMin: z.coerce.number().min(0).max(100),
  callControlFee: z.coerce.number().min(0).max(10).optional(),
});

adminRouter.put("/telnyx-costs/rates/:countryCode", async (req, res) => {
  const countryCode = req.params.countryCode?.toUpperCase();
  if (!countryCode || countryCode.length > 5) {
    return res.status(400).json({ error: "countryCode inválido" });
  }

  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }

  try {
    const { countryName, inboundPerMin, outboundPerMin, callControlFee } = parsed.data;
    const rate = await db.telnyxRate.upsert({
      where: { countryCode },
      update: {
        countryName,
        inboundPerMin,
        outboundPerMin,
        ...(callControlFee !== undefined ? { callControlFee } : {}),
      },
      create: {
        countryCode,
        countryName,
        inboundPerMin,
        outboundPerMin,
        ...(callControlFee !== undefined ? { callControlFee } : {}),
      },
    });

    logger.info({ countryCode, inboundPerMin, outboundPerMin }, "Tarifa Telnyx actualizada");
    res.json({ rate });
  } catch (e) {
    logger.error({ error: (e as Error).message, countryCode }, "Error actualizando tarifa");
    res.status(500).json({ error: "Error actualizando tarifa" });
  }
});

/**
 * DELETE /admin/telnyx-costs/rates/:countryCode
 * Elimina tarifa para un país.
 */
adminRouter.delete("/telnyx-costs/rates/:countryCode", async (req, res) => {
  const countryCode = req.params.countryCode?.toUpperCase();
  try {
    await db.telnyxRate.delete({ where: { countryCode } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: "Tarifa no encontrada" });
  }
});

/**
 * POST /admin/telnyx-costs/rates/bulk
 * Sube múltiples tarifas (útil para importación CSV).
 */
const bulkRateSchema = z.array(rateSchema.extend({
  countryCode: z.string().min(2).max(5)
}));

adminRouter.post("/telnyx-costs/rates/bulk", async (req, res) => {
  const parsed = bulkRateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Formato de tarifas inválido", details: parsed.error.issues });
  }

  try {
    let upsertedCount = 0;
    // Prisma upsert doesn't have createMany/upsertMany, so we use transaction
    await db.$transaction(
      parsed.data.map((rate) => {
        return db.telnyxRate.upsert({
          where: { countryCode: rate.countryCode },
          update: {
            countryName: rate.countryName,
            inboundPerMin: rate.inboundPerMin,
            outboundPerMin: rate.outboundPerMin,
            ...(rate.callControlFee !== undefined ? { callControlFee: rate.callControlFee } : {}),
          },
          create: {
            countryCode: rate.countryCode,
            countryName: rate.countryName,
            inboundPerMin: rate.inboundPerMin,
            outboundPerMin: rate.outboundPerMin,
            ...(rate.callControlFee !== undefined ? { callControlFee: rate.callControlFee } : {}),
          },
        });
      })
    );
    upsertedCount = parsed.data.length;

    logger.info({ count: upsertedCount }, "Bulk de tarifas Telnyx procesado");
    res.json({ success: true, count: upsertedCount });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error en bulk update de tarifas");
    res.status(500).json({ error: "Error interno al guardar masivamente las tarifas" });
  }
});
