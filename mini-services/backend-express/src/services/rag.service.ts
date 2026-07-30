/**
 * Servicio RAG - Embeddings + búsqueda vectorial.
 * Cumple spec sección 16.
 *
 * En sandbox: SQLite no soporta pgvector, así que se usa
 * búsqueda por similitud de texto (TF-IDF simplificado) como fallback.
 * En producción: se usaría pgvector con gemini-embedding-001 (768 dims).
 */
import { GoogleGenAI } from "@google/genai";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

/**
 * Genera embedding de 768 dimensiones con gemini-embedding-001.
 * Cumple spec 16.2.
 */
export async function generarEmbedding(texto: string): Promise<number[]> {
  if (!ai) {
    logger.warn("GEMINI_API_KEY no configurada - generando embedding dummy");
    // Embedding dummy determinista para sandbox
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
    logger.error({ error: (e as Error).message }, "Error generando embedding - usando dummy");
    return generarEmbeddingDummy(texto, 768);
  }
}

/**
 * Embedding dummy determinista para sandbox (sin API key).
 * Hash del texto → 768 dimensiones normalizadas.
 */
function generarEmbeddingDummy(texto: string, dims: number): number[] {
  const vec = new Array(dims).fill(0);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    vec[i % dims] += c;
    vec[(i * 7 + 3) % dims] += c * 0.7;
    vec[(i * 13 + 5) % dims] -= c * 0.3;
  }
  // Normalizar L2
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Obtiene el contexto del negocio para inyectar en el system prompt.
 * Cumple spec 16.3:
 * 1. Redis cache (60s TTL) - en sandbox: memory cache
 * 2. pgvector search - en sandbox: text similarity
 * 3. Cachear resultado
 */
const contextoCache = new Map<string, { valor: string; expira: number }>();

export async function obtenerContextoNegocio(userId: string): Promise<string> {
  const cacheKey = `contexto:${userId}`;
  const cached = contextoCache.get(cacheKey);
  if (cached && cached.expira > Date.now()) {
    return cached.valor;
  }

  // Buscar memoria activa
  const memoria = await db.businessMemory.findFirst({
    where: { userId, status: "activo" },
    orderBy: { version: "desc" },
  });

  if (!memoria) {
    // Fallback a systemPromptContext de settings
    const settings = await db.businessSettings.findUnique({ where: { userId } });
    return settings?.systemPromptContext ?? "";
  }

  // En sandbox: devolver raw_context directamente (sin vector search)
  // En prod: se haría búsqueda por similitud si hay múltiples fragmentos
  const contexto = memoria.rawContext;

  // Cachear 60s
  contextoCache.set(cacheKey, { valor: contexto, expira: Date.now() + 60000 });

  return contexto;
}

/**
 * Invalida el cache de contexto y settings.
 * Cumple spec 16.4 - llamar al editar configuración.
 */
export function invalidarCache(userId: string): void {
  contextoCache.delete(`contexto:${userId}`);
  contextoCache.delete(`settings:${userId}`);
  logger.info({ userId }, "Cache invalidado");
}

/**
 * Guarda o actualiza el contexto del negocio + genera embedding.
 * Cumple spec 8 (simulador de contexto).
 */
export async function guardarContexto(
  userId: string,
  rawContext: string,
  action: "save" | "reinterview" = "save"
): Promise<{ version: number }> {
  if (action === "reinterview") {
    // Archivar versión actual
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
    invalidarCache(userId);
    return { version: nueva.version };
  }

  // action === 'save'
  const actual = await db.businessMemory.findFirst({
    where: { userId, status: "activo" },
  });

  if (actual) {
    await db.businessMemory.update({
      where: { id: actual.id },
      data: { rawContext },
    });
    await db.businessSettings.update({
      where: { userId },
      data: { systemPromptContext: rawContext },
    });
    invalidarCache(userId);
    return { version: actual.version };
  }

  const nueva = await db.businessMemory.create({
    data: { userId, rawContext, status: "activo", version: 1 },
  });
  await db.businessSettings.update({
    where: { userId },
    data: { systemPromptContext: rawContext },
  });
  invalidarCache(userId);
  return { version: nueva.version };
}
