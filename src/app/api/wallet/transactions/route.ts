import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/wallet/transactions?userId=...&limit=50
 * Lista las transacciones del wallet del usuario.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const limit = parseInt(searchParams.get("limit") || "50");

  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const txs = await db.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ transactions: txs });
}
