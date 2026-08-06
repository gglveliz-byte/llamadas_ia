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
    // Express backend already creates the DB record, so we just return the result.
    return NextResponse.json({ phone: result });
  } catch (e) {
    console.error("[phone-numbers] Error en POST:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
