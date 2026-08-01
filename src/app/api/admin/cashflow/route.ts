import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/cashflow?from=...&to=...
 * Reporte de flujo de caja: ingresos (recargas Whop), débitos, balance.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const recargas = await db.walletTransaction.findMany({
    where: { ...where, tipo: "recarga" },
    include: {
      user: {
        select: { businessName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const debitos = await db.walletTransaction.findMany({
    where: { ...where, tipo: "debito" },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const totalRecargas = recargas.reduce((s, t) => s + t.monto.toNumber(), 0);
  const totalDebitos = Math.abs(debitos.reduce((s, t) => s + t.monto.toNumber(), 0));

  const porDia = new Map<string, { recargas: number; debitos: number }>();
  for (const r of recargas) {
    const dia = r.createdAt.toISOString().slice(0, 10);
    const entry = porDia.get(dia) ?? { recargas: 0, debitos: 0 };
    entry.recargas += r.monto.toNumber();
    porDia.set(dia, entry);
  }
  for (const d of debitos) {
    const dia = d.createdAt.toISOString().slice(0, 10);
    const entry = porDia.get(dia) ?? { recargas: 0, debitos: 0 };
    entry.debitos += Math.abs(d.monto.toNumber());
    porDia.set(dia, entry);
  }

  const serie = Array.from(porDia.entries())
    .map(([dia, v]) => ({ dia, ...v, balance: v.recargas - v.debitos }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const transacciones = [...recargas, ...debitos]
    .slice(0, 100)
    .map((t) => ({
      ...t,
      monto: t.monto.toNumber(),
      saldoAnterior: t.saldoAnterior.toNumber(),
      saldoNuevo: t.saldoNuevo.toNumber(),
    }));

  return NextResponse.json({
    totalRecargas,
    totalDebitos,
    balance: totalRecargas - totalDebitos,
    totalTransacciones: recargas.length + debitos.length,
    serie,
    transacciones,
  });
}
