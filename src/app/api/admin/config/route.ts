import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/config
 * Devuelve toda la configuración admin.
 */
export async function GET() {
  const configs = await db.adminConfig.findMany({
    orderBy: { clave: "asc" },
  });
  return NextResponse.json({ configs });
}

/**
 * PATCH /api/admin/config
 * Actualiza un valor de configuración.
 * Body: { clave, valor }
 */
export async function PATCH(req: NextRequest) {
  const { clave, valor } = await req.json();
  if (!clave) return NextResponse.json({ error: "clave requerida" }, { status: 400 });

  const config = await db.adminConfig.upsert({
    where: { clave },
    update: { valor },
    create: { clave, valor },
  });

  return NextResponse.json({ config });
}
