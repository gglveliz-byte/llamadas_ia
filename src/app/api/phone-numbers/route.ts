import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchasePhoneSchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";

/**
 * GET /api/phone-numbers?userId=...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  // Sincronizar automáticamente con Telnyx en segundo plano o bloqueante
  try {
    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";
    
    await fetch(`${expressUrl}/internal/telnyx/sync-numbers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": internalApiKey,
      },
      body: JSON.stringify({ userId }),
    });
  } catch (e) {
    console.warn("[phone-numbers] No se pudo sincronizar con Telnyx", e);
  }

  const numbers = await db.phoneNumber.findMany({
    where: { userId },
    orderBy: { purchasedAt: "desc" },
  });

  return NextResponse.json({ numbers });
}

import { verificarJwt } from "@/lib/auth-utils";

/**
 * POST /api/phone-numbers
 * Compra un número nuevo en el Express (delegado).
 * Body: { userId, phoneNumber }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    verificarJwt(token); // Valida firma
  } catch (e) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";

    // Petición al backend de Express
    const response = await fetch(`${expressUrl}/internal/telnyx/purchase-number`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": internalApiKey,
      },
      body: JSON.stringify({
        userId: body.userId,
        phoneNumber: body.phoneNumber,
        upfrontCost: body.upfrontCost,
        monthlyCost: body.monthlyCost,
        currency: body.currency,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return NextResponse.json({ phone: result });
  } catch (e) {
    console.error("[phone-numbers] Error en POST:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/phone-numbers?id=...&userId=...
 * Elimina (oculta/borra) un número liberado de la vista del cliente.
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idStr = searchParams.get("id");
  const userId = searchParams.get("userId");
  
  if (!idStr || !userId) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    verificarJwt(token); 
  } catch (e) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    const id = parseInt(idStr, 10);
    const numero = await db.phoneNumber.findUnique({ where: { id } });
    
    if (!numero || numero.userId !== userId) {
      return NextResponse.json({ error: "Número no encontrado" }, { status: 404 });
    }

    // Si tiene citas amarradas, quitamos la relación para poder borrar el número sin romper el historial
    await db.appointment.updateMany({
      where: { phoneNumberId: id },
      data: { phoneNumberId: null },
    });

    await db.phoneNumber.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[phone-numbers] Error al eliminar:", error);
    return NextResponse.json({ error: "No se pudo eliminar el número" }, { status: 500 });
  }
}
