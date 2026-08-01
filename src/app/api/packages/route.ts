import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/packages
 * Lista los paquetes de recarga activos.
 */
export async function GET() {
  const paquetes = await db.rechargePackage.findMany({
    where: { activo: true },
    orderBy: { montoRecarga: "asc" },
  });
  return NextResponse.json({
    paquetes: paquetes.map((p) => ({
      ...p,
      montoRecarga: p.montoRecarga.toNumber(),
      saldoOtorgado: p.saldoOtorgado.toNumber(),
      precioPorMinuto: p.precioPorMinuto.toNumber(),
      precioPorSegundo: p.precioPorSegundo?.toNumber() ?? null,
    })),
  });
}
