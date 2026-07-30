import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/session
 * Devuelve el usuario "actual" de la sesión demo.
 */
export async function GET(req: NextRequest) {
  const demoUserId = req.headers.get("x-demo-user-id");
  const demoRole = req.headers.get("x-demo-role") || "cliente";

  let user;
  if (demoUserId) {
    user = await db.user.findUnique({
      where: { id: demoUserId },
      include: { settings: true, wallet: true },
    });
  } else if (demoRole === "admin") {
    user = await db.user.findFirst({
      where: { role: "admin" },
      include: { settings: true, wallet: true },
    });
  } else {
    user = await db.user.findFirst({
      where: { role: "cliente" },
      include: { settings: true, wallet: true },
    });
  }

  if (!user) {
    return NextResponse.json({ error: "No hay usuario demo" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      businessName: user.businessName,
      businessPhone: user.businessPhone,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended,
      twilioSubaccountSid: user.twilioSubaccountSid,
    },
    settings: user.settings,
    wallet: user.wallet,
  });
}

/**
 * POST /api/session
 * Cambia el usuario demo activo.
 */
export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { settings: true, wallet: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      businessName: user.businessName,
      businessPhone: user.businessPhone,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended,
      twilioSubaccountSid: user.twilioSubaccountSid,
    },
    settings: user.settings,
    wallet: user.wallet,
  });
}
