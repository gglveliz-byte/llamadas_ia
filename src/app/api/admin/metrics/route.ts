import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/metrics
 * Devuelve métricas en tiempo real (simuladas) del sistema:
 * - CPU, RAM, Heap, llamadas activas, latencia
 * - Histórico de últimas 60 mediciones (10s cada una = 10 min)
 * - Rate limit Gemini (simulado)
 * - Métricas agregadas: total usuarios, llamadas hoy, ingresos hoy
 */
export async function GET() {
  // Generar series históricas simuladas (60 puntos = 10 min)
  const ahora = Date.now();
  const historial = Array.from({ length: 60 }, (_, i) => {
    const t = ahora - (59 - i) * 10000;
    const base = Math.sin(i / 10) * 15 + 35;
    return {
      ts: new Date(t).toISOString(),
      cpu: Math.max(5, Math.min(95, base + (Math.random() - 0.5) * 20)),
      ram: Math.max(20, Math.min(95, base + 10 + (Math.random() - 0.5) * 15)),
      latencia: Math.max(80, Math.min(1200, 200 + (Math.random() - 0.3) * 400)),
      llamadas: Math.max(0, Math.floor(Math.random() * 8)),
    };
  });

  // Total usuarios
  const totalClientes = await db.user.count({ where: { role: "cliente" } });
  const clientesSuspendidos = await db.user.count({
    where: { role: "cliente", isSuspended: true },
  });

  // Llamadas hoy
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const llamadasHoy = await db.callMetric.count({
    where: { inicio: { gte: inicioHoy } },
  });

  const minutosHoy = await db.callMetric.aggregate({
    where: { inicio: { gte: inicioHoy } },
    _sum: { duracionSegundos: true },
  });

  // Ingresos hoy (débitos)
  const ingresosHoy = await db.walletTransaction.aggregate({
    where: { tipo: "debito", createdAt: { gte: inicioHoy } },
    _sum: { monto: true },
  });

  // Recargas hoy
  const recargasHoy = await db.walletTransaction.aggregate({
    where: { tipo: "recarga", createdAt: { gte: inicioHoy } },
    _sum: { monto: true },
  });

  // Latencia promedio de las últimas 50 llamadas
  const ultimasMetricas = await db.callMetric.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { latenciaPromedioMs: true, latenciaMaxMs: true, errorCode: true },
  });

  const latenciaPromedio =
    ultimasMetricas.reduce((s, m) => s + (m.latenciaPromedioMs ?? 0), 0) /
    (ultimasMetricas.length || 1);

  const erroresRecientes = ultimasMetricas.filter((m) => m.errorCode).length;

  // Último punto = estado "actual"
  const actual = historial[historial.length - 1];

  // Traer umbrales desde admin_config
  const umbrales = await db.adminConfig.findMany({
    where: {
      clave: {
        in: ["alerta_cpu_porcentaje", "alerta_ram_porcentaje", "alerta_latencia_ms"],
      },
    },
  });
  const umbralCPU = parseFloat(umbrales.find((u) => u.clave === "alerta_cpu_porcentaje")?.valor ?? "85");
  const umbralRAM = parseFloat(umbrales.find((u) => u.clave === "alerta_ram_porcentaje")?.valor ?? "90");
  const umbralLatencia = parseInt(umbrales.find((u) => u.clave === "alerta_latencia_ms")?.valor ?? "600");

  return NextResponse.json({
    actual: {
      ...actual,
      heap: process.memoryUsage().heapUsed / 1024 / 1024,
      uptime: process.uptime(),
      llamadasActivas: actual.llamadas,
    },
    historial,
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
        resetAt: new Date(ahora + 3600000).toISOString(),
      },
      twilio: {
        concurrentCalls: actual.llamadas,
        maxConcurrent: 50,
      },
      whop: {
        lastWebhook: new Date(ahora - 60000).toISOString(),
        status: "ok",
      },
    },
    umbrales: { cpu: umbralCPU, ram: umbralRAM, latencia: umbralLatencia },
    alertas: [],
  });
}
