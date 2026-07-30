import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/business-memory?userId=...
 * Devuelve el contexto RAG activo del negocio.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const memoria = await db.businessMemory.findFirst({
    where: { userId, status: "activo" },
    orderBy: { version: "desc" },
  });

  const historial = await db.businessMemory.findMany({
    where: { userId, status: "archivado" },
    orderBy: { version: "desc" },
    take: 10,
  });

  return NextResponse.json({ memoria, historial });
}

/**
 * POST /api/business-memory
 * Guarda o actualiza el contexto RAG del negocio.
 * Body: { userId, rawContext, action: 'save' | 'reinterview' }
 * - 'save': actualiza el contexto activo (incrementa versión)
 * - 'reinterview': archiva el actual y crea uno nuevo
 */
export async function POST(req: NextRequest) {
  const { userId, rawContext, action = "save" } = await req.json();
  if (!userId || !rawContext) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  if (action === "reinterview") {
    // Archivar la versión actual
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
    // Actualizar systemPromptContext en settings
    await db.businessSettings.update({
      where: { userId },
      data: { systemPromptContext: rawContext },
    });
    return NextResponse.json({ memoria: nueva });
  }

  // action === 'save': actualizar el activo (sin cambiar versión)
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
