import { NextRequest, NextResponse } from "next/server";
import { verificarJwt } from "@/lib/auth-utils";

function checkAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7);
    const payload = verificarJwt(token) as any;
    if (payload.role !== "admin") return null;
    return token;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/telnyx-costs/rates/bulk
 * Proxy al backend Express para subir múltiples tarifas.
 */
export async function POST(req: NextRequest) {
  const token = checkAdmin(req);
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const response = await fetch(`${expressUrl}/admin/telnyx-costs/rates/bulk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
