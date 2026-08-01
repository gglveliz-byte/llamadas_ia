import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/wallet?userId=...
 * Devuelve wallet + última recarga para calcular % de saldo.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    // Usuario sin wallet (típicamente admin) — devolver valores por defecto
    return NextResponse.json({
      wallet: { userId, saldo: 0, moneda: "USD", updatedAt: new Date().toISOString() },
      ultimaRecarga: null,
      totalRecargado: 0,
      totalDebitado: 0,
      porcentajeSaldo: 0,
    });
  }

  const ultimaRecarga = await db.walletTransaction.findFirst({
    where: { userId, tipo: "recarga" },
    orderBy: { createdAt: "desc" },
  });

  const totalRecargado = await db.walletTransaction.aggregate({
    where: { userId, tipo: "recarga" },
    _sum: { monto: true },
  });

  const totalDebitado = await db.walletTransaction.aggregate({
    where: { userId, tipo: "debito" },
    _sum: { monto: true },
  });

  return NextResponse.json({
    wallet: { ...wallet, saldo: wallet.saldo.toNumber() },
    ultimaRecarga,
    totalRecargado: totalRecargado._sum.monto?.toNumber() ?? 0,
    totalDebitado: Math.abs(totalDebitado._sum.monto?.toNumber() ?? 0),
    porcentajeSaldo: ultimaRecarga
      ? (wallet.saldo.toNumber() / ultimaRecarga.monto.toNumber()) * 100
      : 100,
  });
}
