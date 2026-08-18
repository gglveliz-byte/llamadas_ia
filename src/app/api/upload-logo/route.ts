import { NextResponse } from "next/server";
import { verificarJwt } from "@/lib/auth-utils";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    let payload;
    try {
      payload = verificarJwt(token);
    } catch (e) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { base64Data, fileName, mimeType } = body;

    if (!base64Data || !fileName || !mimeType) {
      return NextResponse.json({ error: "Faltan datos de archivo" }, { status: 400 });
    }

    const expressUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const internalKey = process.env.INTERNAL_API_KEY || "vozia-dev-internal-api-key";

    const res = await fetch(`${expressUrl}/internal/upload-logo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": internalKey
      },
      body: JSON.stringify({ base64Data, fileName, mimeType })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Error en backend" }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Error interno del servidor", details: error.message }, { status: 500 });
  }
}
