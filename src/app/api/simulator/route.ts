import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/simulator/transcript?userId=...
 * Devuelve la transcripción de la última sesión del simulador (mock).
 * En producción vendría de la sesión Gemini Live grabada.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const memoria = await db.businessMemory.findFirst({
    where: { userId, status: "activo" },
  });

  // Devolver un transcript de muestra si existe contexto
  const transcriptDemo = memoria
    ? [
        {
          rol: "ai",
          texto: `Hola, soy tu entrevistador de voz. Veo que ya tienes información sobre ${memoria.rawContext.slice(0, 60)}... ¿Qué partes quieres actualizar o agregar? También podemos empezar desde cero si prefieres.`,
          ts: Date.now() - 30000,
        },
        {
          rol: "user",
          texto: "Quiero actualizar los precios de los servicios.",
          ts: Date.now() - 25000,
        },
        {
          rol: "ai",
          texto: "Perfecto. Dime los nuevos precios de cada servicio que tengas registrado.",
          ts: Date.now() - 20000,
        },
        {
          rol: "user",
          texto: "El corte clásico ahora cuesta $250, el fade $300 y la barba $150.",
          ts: Date.now() - 15000,
        },
        {
          rol: "ai",
          texto: "Listo, he actualizado los precios. ¿Te doy un resumen completo del contexto?",
          ts: Date.now() - 10000,
        },
        {
          rol: "user",
          texto: "Sí, está bien.",
          ts: Date.now() - 5000,
        },
      ]
    : [];

  return NextResponse.json({ transcript: transcriptDemo, memoria });
}

/**
 * POST /api/simulator/save-context
 * Guarda el contexto extraído por la entrevista de voz.
 * Body: { userId, rawContext, action }
 */
export async function POST(req: NextRequest) {
  const { userId, rawContext, action = "save" } = await req.json();

  if (action === "reinterview") {
    const actual = await db.businessMemory.findFirst({
      where: { userId, status: "activo" },
    });
    if (actual) {
      await db.businessMemory.update({
        where: { id: actual.id },
        data: { status: "archivado" },
      });
    }
    const nueva = await db.businessMemory.create({
      data: {
        userId,
        rawContext,
        status: "activo",
        version: (actual?.version ?? 0) + 1,
      },
    });
    await db.businessSettings.update({
      where: { userId },
      data: { systemPromptContext: rawContext },
    });
    return NextResponse.json({ memoria: nueva });
  }

  const actual = await db.businessMemory.findFirst({
    where: { userId, status: "activo" },
  });
  if (actual) {
    const actualizada = await db.businessMemory.update({
      where: { id: actual.id },
      data: { rawContext },
    });
    await db.businessSettings.update({
      where: { userId },
      data: { systemPromptContext: rawContext },
    });
    return NextResponse.json({ memoria: actualizada });
  } else {
    const nueva = await db.businessMemory.create({
      data: { userId, rawContext, status: "activo", version: 1 },
    });
    await db.businessSettings.update({
      where: { userId },
      data: { systemPromptContext: rawContext },
    });
    return NextResponse.json({ memoria: nueva });
  }
}
