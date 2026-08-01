import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchasePhoneSchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";
import { ApiClient } from "@/lib/api";

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
    // Llamar al backend Express para comprar número real via Telnyx
    const result = await ApiClient.post<{ phoneNumber: string; telnyxId: string }>(
      "/internal/telnyx/purchase-number",
      { userId, countryCode, areaCode }
    );

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
