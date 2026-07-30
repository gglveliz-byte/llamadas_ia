import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/users
 * Lista los usuarios disponibles para cambiar contexto (demo).
 * Solo clientes (no admin) — para admin se usa /api/admin/clients.
 */
export async function GET() {
  const users = await db.user.findMany({
    where: { role: "cliente" },
    select: {
      id: true,
      email: true,
      businessName: true,
      businessPhone: true,
      role: true,
      isSuspended: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const admin = await db.user.findFirst({
    where: { role: "admin" },
    select: {
      id: true,
      email: true,
      businessName: true,
      role: true,
    },
  });

  return NextResponse.json({
    clientes: users,
    admin: admin ? [admin] : [],
  });
}
