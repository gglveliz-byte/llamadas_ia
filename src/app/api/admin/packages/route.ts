import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminPackageCreateSchema, adminPackageUpdateSchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";
import { Prisma } from "@prisma/client";

type Paquete = Prisma.RechargePackageGetPayload<Record<string, never>>;

function serializarPaquete(p: Paquete) {
  return {
    ...p,
    montoRecarga: p.montoRecarga.toNumber(),
    saldoOtorgado: p.saldoOtorgado.toNumber(),
    precioPorMinuto: p.precioPorMinuto.toNumber(),
    precioPorSegundo: p.precioPorSegundo?.toNumber() ?? null,
  };
}

/**
 * GET /api/admin/packages
 * Lista todos los paquetes de recarga.
 */
export async function GET() {
  const paquetes = await db.rechargePackage.findMany({
    orderBy: { montoRecarga: "asc" },
  });
  return NextResponse.json({ paquetes: paquetes.map(serializarPaquete) });
}

/**
 * POST /api/admin/packages
 * Crea un nuevo paquete.
 * Body: { nombre, montoRecarga, saldoOtorgado, precioPorMinuto, activo }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const val = validate(adminPackageCreateSchema, body);
  if (val.error) return val.error;
  const { nombre, montoRecarga, saldoOtorgado, precioPorMinuto, activo } = val.data!;
  const paquete = await db.rechargePackage.create({
    data: {
      nombre,
      montoRecarga,
      saldoOtorgado,
      precioPorMinuto,
      precioPorSegundo: precioPorMinuto / 60,
      activo,
    },
  });
  return NextResponse.json({ paquete: serializarPaquete(paquete) });
}

/**
 * PATCH /api/admin/packages
 * Actualiza un paquete.
 * Body: { id, ...campos }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const val = validate(adminPackageUpdateSchema, body);
  if (val.error) return val.error;
  const { id, ...updates } = val.data!;
  const data: Record<string, unknown> = { ...updates };
  if (updates.precioPorMinuto !== undefined) {
    data.precioPorSegundo = updates.precioPorMinuto / 60;
  }

  const paquete = await db.rechargePackage.update({
    where: { id: parseInt(id) },
    data,
  });
  return NextResponse.json({ paquete: serializarPaquete(paquete) });
}

/**
 * DELETE /api/admin/packages?id=...
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  await db.rechargePackage.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
