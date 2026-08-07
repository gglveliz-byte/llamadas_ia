import { NextRequest, NextResponse } from "next/server";
import { verificarJwt } from "@/lib/auth-utils";

/**
 * POST /api/outbound-call
 * Inicia una llamada saliente (proxy autenticado al backend).
 * Body: { userId, from, to }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    verificarJwt(token);
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const body = await req.json();

  try {
    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";

    const response = await fetch(`${expressUrl}/internal/telnyx/outbound-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": internalApiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[outbound-call] Error en POST:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
