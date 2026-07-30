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
  return NextResponse.json({ paquetes });
}
