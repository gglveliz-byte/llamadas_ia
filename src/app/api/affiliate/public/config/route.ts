import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const comisionCfg = await db.adminConfig.findUnique({ where: { clave: "afiliado_comision_minuto_default" } });
    const feeCfg = await db.adminConfig.findUnique({ where: { clave: "fee_instalacion_minimo" } });
    const gananciaCfg = await db.adminConfig.findUnique({ where: { clave: "afiliado_ganancia_instalacion_default" } });

    return NextResponse.json({
      comisionPorMinuto: parseFloat(comisionCfg?.valor || "0.05"),
      feeInstalacion: parseFloat(feeCfg?.valor || "200.00"),
      gananciaInstalacion: parseFloat(gananciaCfg?.valor || "50.00"),
    });
  } catch (error) {
    console.error("Error en GET /api/affiliate/public/config", error);
    return NextResponse.json({ comisionPorMinuto: 0.05, feeInstalacion: 200, gananciaInstalacion: 50 });
  }
}
