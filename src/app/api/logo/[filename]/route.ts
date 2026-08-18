import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const expressUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  
  try {
    const backendRes = await fetch(`${expressUrl}/api/public/logo/${filename}`, {
      method: "GET"
    });

    if (!backendRes.ok) {
      return new NextResponse("Logo no encontrado", { status: backendRes.status });
    }

    const arrayBuffer = await backendRes.arrayBuffer();
    const contentType = backendRes.headers.get("Content-Type") || "image/png";
    const cacheControl = backendRes.headers.get("Cache-Control") || "public, max-age=31536000";

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      }
    });
  } catch (error) {
    return new NextResponse("Error interno del servidor proxy", { status: 500 });
  }
}
