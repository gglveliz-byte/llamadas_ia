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
 * GET /api/admin/telnyx-costs/rates
 * Proxy al backend Express para listar tarifas por minuto.
 */
export async function GET(req: NextRequest) {
  const token = checkAdmin(req);
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const response = await fetch(`${expressUrl}/admin/telnyx-costs/rates`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/telnyx-costs/rates
 * Proxy al backend Express para crear/actualizar tarifa.
 * Body: { countryCode, countryName, inboundPerMin, outboundPerMin, callControlFee? }
 */
export async function PUT(req: NextRequest) {
  const token = checkAdmin(req);
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { countryCode, ...rest } = body;
    if (!countryCode) {
      return NextResponse.json({ error: "countryCode requerido" }, { status: 400 });
    }

    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const response = await fetch(
      `${expressUrl}/admin/telnyx-costs/rates/${encodeURIComponent(countryCode)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rest),
      }
    );

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/telnyx-costs/rates
 * Proxy al backend Express para eliminar tarifa.
 * Body: { countryCode }
 */
export async function DELETE(req: NextRequest) {
  const token = checkAdmin(req);
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const countryCode = searchParams.get("countryCode");
    if (!countryCode) {
      return NextResponse.json({ error: "countryCode requerido" }, { status: 400 });
    }

    const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    const response = await fetch(
      `${expressUrl}/admin/telnyx-costs/rates/${encodeURIComponent(countryCode)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
