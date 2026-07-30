import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
 * Simula compra de un número Twilio.
 * Body: { userId, countryCode, areaCode }
 */
export async function POST(req: NextRequest) {
  const { userId, countryCode = "+1" } = await req.json();

  // Generar número "comprado" (en prod: Twilio API)
  const numero = countryCode + Math.floor(1000000 + Math.random() * 9000000);

  const phone = await db.phoneNumber.create({
    data: {
      userId,
      phoneNumber: numero,
      countryCode,
      twilioPhoneSid: "PN" + Math.random().toString(36).slice(2, 14).toUpperCase(),
    },
  });

  return NextResponse.json({ phone });
}
