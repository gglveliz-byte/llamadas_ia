import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { businessMemorySchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";

/**
 * GET /api/simulator/transcript?userId=...
 * Devuelve la transcripción real de las últimas sesiones del usuario
 * (persistida por el backend durante llamadas y simulaciones Gemini Live).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 1000);

  const [transcripts, memoria] = await Promise.all([
    db.callTranscript.findMany({
      where: { userId },
      orderBy: { ts: "asc" },
      take: limit,
    }),
    db.businessMemory.findFirst({
      where: { userId, status: "activo" },
    }),
  ]);

  const transcript = transcripts.map((t) => ({
    rol: t.rol,
    texto: t.texto,
    ts: t.ts.getTime(),
    callSid: t.callSid,
  }));

  return NextResponse.json({ transcript, memoria });
}

/**
 * POST /api/simulator/save-context
 * Guarda el contexto extraído por la entrevista de voz.
 * Body: { userId, rawContext, action }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const val = validate(businessMemorySchema, body);
  if (val.error) return val.error;
  const { userId, rawContext, action } = val.data!;

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
