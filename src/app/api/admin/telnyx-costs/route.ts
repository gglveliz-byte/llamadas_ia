import { NextRequest, NextResponse } from "next/server";
import { verificarJwt } from "@/lib/auth-utils";

/**
 * GET /api/admin/telnyx-costs?countryCode=US
 * Proxy al backend Express para obtener precios reales de números Telnyx.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    const payload = verificarJwt(token);
    if ((payload as any).role !== "admin") {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const countryCode = searchParams.get("countryCode");
  if (!countryCode) {
    return NextResponse.json({ error: "countryCode requerido" }, { status: 400 });
  }

  try {
    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const response = await fetch(
      `${expressUrl}/admin/telnyx-costs/numbers?countryCode=${encodeURIComponent(countryCode)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authHeader.slice(7)}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return NextResponse.json(err, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[admin/telnyx-costs] Error:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
