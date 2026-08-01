import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/metrics
 * Métricas del sistema. Prioriza el backend Express real (CPU/RAM/latencia,
 * historial, rate limits). Si Express no está disponible, sirve agregados
 * reales de BD y deja los campos de tiempo real en 0.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // 1. Intentar leer del backend Express real
  const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
  try {
    const upstream = await fetch(`${expressUrl}/internal/metrics`, {
      headers: {
        "x-internal-api-key": process.env.INTERNAL_API_KEY || "dev",
        "x-user-id": "admin",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (upstream.ok) {
      const data = await upstream.json();
      return NextResponse.json({ ...data, fuente: "express-backend" });
    }
  } catch (e) {
    console.warn("[Métricas] Express no disponible, usando fallback BD:", (e as Error).message);
  }

  // 2. Fallback honesto: solo lo que se puede calcular con datos reales de BD
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const [
    totalClientes,
    clientesSuspendidos,
    llamadasHoy,
    minutosHoy,
    ingresosHoy,
    recargasHoy,
    ultimasMetricas,
    umbralesRaw,
  ] = await Promise.all([
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
    db.callMetric.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { latenciaPromedioMs: true, errorCode: true },
    }),
    db.adminConfig.findMany({
      where: {
        clave: {
          in: ["alerta_cpu_porcentaje", "alerta_ram_porcentaje", "alerta_latencia_ms"],
        },
      },
    }),
  ]);

  const latenciaPromedio =
    ultimasMetricas.reduce((s, m) => s + (m.latenciaPromedioMs ?? 0), 0) /
    (ultimasMetricas.length || 1);

  const erroresRecientes = ultimasMetricas.filter((m) => m.errorCode).length;

  const umbrales = {
    cpu: parseFloat(umbralesRaw.find((u) => u.clave === "alerta_cpu_porcentaje")?.valor ?? "85"),
    ram: parseFloat(umbralesRaw.find((u) => u.clave === "alerta_ram_porcentaje")?.valor ?? "90"),
    latencia: parseInt(umbralesRaw.find((u) => u.clave === "alerta_latencia_ms")?.valor ?? "600"),
  };

  return NextResponse.json({
    actual: {
      cpu: 0,
      ram: 0,
      latencia: 0,
      llamadas: 0,
      llamadasActivas: 0,
      heapMb: process.memoryUsage().heapUsed / 1024 / 1024,
      uptime: process.uptime(),
      ts: new Date().toISOString(),
    },
    historial: [],
    aggregate: {
      totalClientes,
      clientesSuspendidos,
      llamadasHoy,
      minutosHoy: Math.floor((minutosHoy._sum.duracionSegundos ?? 0) / 60),
      ingresosHoy: Math.abs(ingresosHoy._sum.monto?.toNumber() ?? 0),
      recargasHoy: recargasHoy._sum.monto?.toNumber() ?? 0,
      latenciaPromedio,
      erroresRecientes,
    },
    rateLimits: {
      gemini: { remaining: 0, limit: 1, resetAt: new Date().toISOString() },
      telnyx: { concurrentCalls: 0, maxConcurrent: 50 },
      whop: { lastWebhook: new Date().toISOString(), status: "desconocido" },
    },
    umbrales,
    alertas: [],
    fuente: "fallback-db",
  });
}
