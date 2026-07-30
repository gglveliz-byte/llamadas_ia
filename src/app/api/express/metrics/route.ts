import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy al endpoint /internal/metrics del backend Express.
 * Cumple spec sección 13.4.
 *
 * Permite al frontend leer métricas en tiempo real del Express sin exponer
 * el puerto interno directamente.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const upstream = await fetch("http://localhost:3001/internal/metrics", {
      headers: {
        "x-internal-api-key": process.env.INTERNAL_API_KEY || "dev",
        "x-user-id": "admin",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Backend error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: `Error conectando al backend Express: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
