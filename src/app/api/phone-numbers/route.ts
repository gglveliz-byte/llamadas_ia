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

/**
 * POST /api/phone-numbers
 * Compra un número real vía Telnyx (vía Express internal API).
 * Body: { userId, countryCode, areaCode }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const val = validate(purchasePhoneSchema, body);
  if (val.error) return val.error;
  const { userId, countryCode, areaCode } = val.data!;

  try {
    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";
    
    const response = await fetch(`${expressUrl}/internal/telnyx/purchase-number`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": internalApiKey,
        "x-user-id": userId,
      },
      body: JSON.stringify({ userId, countryCode, areaCode })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    
    const result = (await response.json()) as { phoneNumber: string; telnyxId: string };

    // Guardar en BD local
    const phone = await db.phoneNumber.create({
      data: {
        userId,
        phoneNumber: result.phoneNumber,
        countryCode,
        telnyxPhoneSid: result.telnyxId,
        isActive: true,
      },
    });

    return NextResponse.json({ phone });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
