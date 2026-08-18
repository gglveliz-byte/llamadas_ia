import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
  
  try {
    const body = await req.json();
    
    const backendRes = await fetch(`${expressUrl}/api/affiliate/public/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error en POST /api/affiliate/public/register", error);
    return NextResponse.json({ error: "Error interno del servidor proxy" }, { status: 500 });
  }
}
