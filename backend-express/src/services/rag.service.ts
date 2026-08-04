import { GoogleGenAI } from "@google/genai";
import { db } from "../models/database.pool";
import { cacheGet, cacheSet, cacheDel } from "./cache.service";
import { logger } from "../utils/logger";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

export async function generarEmbedding(texto: string): Promise<number[]> {
  if (!ai) {
    return generarEmbeddingDummy(texto, 768);
  }
  try {
    const result = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: texto,
      config: { outputDimensionality: 768 },
    });
    return result.embeddings?.[0]?.values ?? generarEmbeddingDummy(texto, 768);
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error generando embedding");
    return generarEmbeddingDummy(texto, 768);
  }
}

function generarEmbeddingDummy(texto: string, dims: number): number[] {
  const vec = new Array(dims).fill(0);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    vec[i % dims] += c;
    vec[(i * 7 + 3) % dims] += c * 0.7;
    vec[(i * 13 + 5) % dims] -= c * 0.3;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function obtenerContextoNegocio(userId: string): Promise<string> {
  const cacheKey = `contexto:${userId}`;

  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;

  const memoria = await db.businessMemory.findFirst({
    where: { userId, status: "activo" },
    orderBy: { version: "desc" },
  });

  if (!memoria) {
    const settings = await db.businessSettings.findUnique({ where: { userId } });
    const contexto = settings?.systemPromptContext ?? "";
    await cacheSet(cacheKey, contexto, 60);
    return contexto;
  }

  const contexto = memoria.rawContext;
  await cacheSet(cacheKey, contexto, 60);
  return contexto;
}

export async function obtenerContextoRAG(
  userId: string,
  consulta: string
): Promise<string> {
  const cacheKey = `contexto:${userId}`;
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;

  const embedding = await generarEmbedding(consulta || "");
  if (embedding.length === 0) return obtenerContextoNegocio(userId);

  try {
    const vectorStr = `[${embedding.join(",")}]`;
    const results = (await db.$queryRawUnsafe(
      `SELECT raw_context, 1 - (embedding <=> $1::vector) AS similitud
       FROM business_memory
       WHERE user_id = $2 AND status = 'activo'
       ORDER BY embedding <=> $1::vector
       LIMIT 3`,
      vectorStr,
      userId
    )) as Array<{ raw_context: string; similitud: number }>;

    if (results && results.length > 0) {
      const contexto = results.map((r) => r.raw_context).join("\n---\n");
      await cacheSet(cacheKey, contexto, 60);
      return contexto;
    }
  } catch (e) {
    logger.warn({ error: (e as Error).message, userId }, "pgvector search falló, usando fallback");
  }

  return obtenerContextoNegocio(userId);
}

export async function invalidarCache(userId: string): Promise<void> {
  await cacheDel(`contexto:${userId}`);
  await cacheDel(`settings:${userId}`);
  logger.info({ userId }, "Cache invalidado");
}

export async function guardarContexto(
  userId: string,
  rawContext: string,
  action: "save" | "reinterview" = "save"
): Promise<{ version: number }> {
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
    const nuevaVersion = (actual?.version ?? 0) + 1;
    const embedding = await generarEmbedding(rawContext);
    const nuevaId = await insertarMemoria(userId, rawContext, embedding, nuevaVersion);
    await db.businessSettings.update({
      where: { userId },
      data: { systemPromptContext: rawContext },
    });
    await invalidarCache(userId);
    return { version: nuevaVersion };
  }

  const actual = await db.businessMemory.findFirst({
    where: { userId, status: "activo" },
  });

  if (actual) {
    if (actual.rawContext !== rawContext) {
      const embedding = await generarEmbedding(rawContext);
      await actualizarMemoria(actual.id, rawContext, embedding);
    }
    await db.businessSettings.update({
      where: { userId },
      data: { systemPromptContext: rawContext },
    });
    await invalidarCache(userId);
    return { version: actual.version };
  }

  const embedding = await generarEmbedding(rawContext);
  const nuevaId = await insertarMemoria(userId, rawContext, embedding, 1);
  await db.businessSettings.update({
    where: { userId },
    data: { systemPromptContext: rawContext },
  });
  await invalidarCache(userId);
  return { version: 1 };
}

async function insertarMemoria(
  userId: string,
  rawContext: string,
  embedding: number[],
  version: number
): Promise<number> {
  try {
    const vectorStr = `[${embedding.join(",")}]`;
    const results = (await db.$queryRawUnsafe(
      `INSERT INTO business_memory (user_id, raw_context, embedding, status, version)
       VALUES ($1, $2, $3::vector, 'activo', $4)
       RETURNING id`,
      userId,
      rawContext,
      vectorStr,
      version
    )) as Array<{ id: number }>;
    return results?.[0]?.id ?? 0;
  } catch {
    // Fallback sin embedding si falla pgvector
    const nueva = await db.businessMemory.create({
      data: { userId, rawContext, status: "activo", version },
    });
    return nueva.id;
  }
}

async function actualizarMemoria(
  id: number,
  rawContext: string,
  embedding: number[]
): Promise<void> {
  if (embedding.length > 0 && ai) {
    const vectorStr = `[${embedding.join(",")}]`;
    await db.$executeRawUnsafe(
      `UPDATE business_memory SET raw_context = $1, embedding = $2::vector WHERE id = $3`,
      rawContext,
      vectorStr,
      id
    );
  } else {
    await db.businessMemory.update({
      where: { id },
      data: { rawContext },
    });
  }
}

export async function buscarContextoPorSimilitud(
  userId: string,
  consulta: string,
  limite: number = 3
): Promise<Array<{ rawContext: string; similitud: number; version: number }>> {
  const embedding = await generarEmbedding(consulta);
  if (embedding.length === 0 || !ai) return [];

  try {
    const vectorStr = `[${embedding.join(",")}]`;
    const results = (await db.$queryRawUnsafe(
      `SELECT raw_context, 1 - (embedding <=> $1::vector) AS similitud, version
       FROM business_memory
       WHERE user_id = $2 AND status = 'activo'
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      vectorStr,
      userId,
      limite
    )) as Array<{ raw_context: string; similitud: number; version: number }>;

    return (results || []).map((r) => ({
      rawContext: r.raw_context,
      similitud: r.similitud,
      version: r.version,
    }));
  } catch (e) {
    logger.error({ error: (e as Error).message, userId }, "Error en búsqueda pgvector");
    return [];
  }
}
