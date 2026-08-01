import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminConfigUpdateSchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";

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
  const body = await req.json();
  const val = validate(adminConfigUpdateSchema, body);
  if (val.error) return val.error;
  const { clave, valor } = val.data!;

  const config = await db.adminConfig.upsert({
    where: { clave },
    update: { valor },
    create: { clave, valor },
  });

  return NextResponse.json({ config });
}
