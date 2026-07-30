import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/packages
 * Lista todos los paquetes de recarga.
 */
export async function GET() {
  const paquetes = await db.rechargePackage.findMany({
    orderBy: { montoRecarga: "asc" },
  });
  return NextResponse.json({ paquetes });
}

/**
 * POST /api/admin/packages
 * Crea un nuevo paquete.
 * Body: { nombre, montoRecarga, saldoOtorgado, precioPorMinuto, activo }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const paquete = await db.rechargePackage.create({
    data: {
      nombre: body.nombre,
      montoRecarga: parseFloat(body.montoRecarga),
      saldoOtorgado: parseFloat(body.saldoOtorgado),
      precioPorMinuto: parseFloat(body.precioPorMinuto),
      precioPorSegundo: parseFloat(body.precioPorMinuto) / 60,
      activo: body.activo ?? true,
    },
  });
  return NextResponse.json({ paquete });
}

/**
 * PATCH /api/admin/packages
 * Actualiza un paquete.
 * Body: { id, ...campos }
 */
export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json();
  const data: Record<string, unknown> = { ...updates };
  if (updates.montoRecarga) data.montoRecarga = parseFloat(updates.montoRecarga);
  if (updates.saldoOtorgado) data.saldoOtorgado = parseFloat(updates.saldoOtorgado);
  if (updates.precioPorMinuto) {
    data.precioPorMinuto = parseFloat(updates.precioPorMinuto);
    data.precioPorSegundo = parseFloat(updates.precioPorMinuto) / 60;
  }

  const paquete = await db.rechargePackage.update({
    where: { id: parseInt(id) },
    data,
  });
  return NextResponse.json({ paquete });
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
