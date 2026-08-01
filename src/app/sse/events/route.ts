import { NextRequest } from "next/server";

/**
 * Proxy SSE al backend Express.
 * Cumple spec sección 12.1.
 *
 * El frontend hace EventSource('/sse/events?user_id=...') y este handler
 * hace de proxy streaming hacia el backend Express en puerto 3001.
 *
 * Necesario porque EventSource no soporta headers custom, y el gateway Caddy
 * solo está disponible en producción (no en dev directo a localhost:3000).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  const token = searchParams.get("token");

  if (!userId) {
    return new Response("user_id requerido", { status: 400 });
  }

  // URL del backend Express
  const backendUrl = `${process.env.DOMINIO_EXPRESS}/sse/events?user_id=${encodeURIComponent(userId)}${token ? `&token=${encodeURIComponent(token)}` : ""}`;

  try {
    const upstream = await fetch(backendUrl, {
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(`Backend error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    // Stream the response through
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return new Response(`Error conectando al backend: ${(e as Error).message}`, {
      status: 502,
    });
  }
}
