import { NextRequest, NextResponse } from "next/server";
import { verificarJwt } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    verificarJwt(token); // Valida que el usuario tenga sesión
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const countryCode = searchParams.get("countryCode");
  const areaCode = searchParams.get("areaCode");
  const limit = searchParams.get("limit") || "10";

  if (!countryCode) {
    return NextResponse.json({ error: "countryCode es requerido" }, { status: 400 });
  }

  try {
    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";
    
    const query = new URLSearchParams({ countryCode, limit });
    if (areaCode) query.append("areaCode", areaCode);

    const response = await fetch(`${expressUrl}/internal/telnyx/available-numbers?${query.toString()}`, {
      method: "GET",
      headers: {
        "x-internal-api-key": internalApiKey,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[phone-numbers/search] Error en GET:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
