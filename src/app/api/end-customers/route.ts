import { NextRequest, NextResponse } from "next/server";
import { verificarJwt } from "@/lib/auth-utils";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  let userId: string;
  try {
    const payload = verificarJwt(token) as any;
    userId = payload.userId;
    if (!userId) throw new Error("Falta userId en token");
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId") || userId;

    const endCustomers = await db.endCustomer.findMany({
      where: { tenantId: targetUserId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ endCustomers });
  } catch (e: any) {
    return NextResponse.json({ error: "Error de servidor", details: e.message }, { status: 500 });
  }
}
