import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";
import type { Session } from "@google/genai";
import { db } from "../models/database.pool";
import { guardarContexto, obtenerContextoNegocio } from "../services/rag.service";
import { emitirSSE } from "../sse/events.emitter";
import { logger } from "../utils/logger";

const ai = (process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null) as any;

const live = ai.live as any;

const MODELO = process.env.GEMINI_MODEL || "models/gemini-3.1-flash-live-preview";

interface SesionSimulador {
  ws: WebSocket;
  userId: string;
  gemini: Session | null;
  ultimaActividad: number;
  timeoutSilencio: ReturnType<typeof setTimeout> | null;
  timeoutCierre: ReturnType<typeof setTimeout> | null;
  contextoGuardado: string | null;
  conversacionBuffer: string[];
  transcripts: Array<{ texto: string; rol: string; ts: number }>;
}

const sesiones = new Map<string, SesionSimulador>();

const SILENCIO_AVISO_MS = 30000;
const SILENCIO_CIERRE_MS = 60000;

export function registrarSimuladorHandler(wss: WebSocketServer): void {
  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", "http://localhost");
    const userId = url.searchParams.get("user_id");
    const callSid = `sim_${userId}_${Date.now()}`;

    if (!userId) {
      ws.close(4000, "user_id requerido");
      return;
    }

    logger.info({ userId, callSid }, "Simulador conectado");

    const sesion: SesionSimulador = {
      ws,
      userId,
      gemini: null,
      ultimaActividad: Date.now(),
      timeoutSilencio: null,
      timeoutCierre: null,
      contextoGuardado: null,
      conversacionBuffer: [],
      transcripts: [],
    };
    sesiones.set(callSid, sesion);

    const limpiarTimeouts = () => {
      if (sesion.timeoutSilencio) clearTimeout(sesion.timeoutSilencio);
      if (sesion.timeoutCierre) clearTimeout(sesion.timeoutCierre);
    };

    const resetearTimeouts = () => {
      limpiarTimeouts();
      sesion.ultimaActividad = Date.now();
      sesion.timeoutSilencio = setTimeout(() => {
        enviarTexto(ws, "¿Sigues ahí? Si necesitas más tiempo, puedes volver a iniciar la conversación.");
        sesion.timeoutCierre = setTimeout(async () => {
          enviarTexto(ws, "La sesión ha expirado por inactividad. El contexto se perderá.");
          await cerrarSimulador(callSid);
        }, SILENCIO_CIERRE_MS);
      }, SILENCIO_AVISO_MS);
    };

    const cerrarSimulador = async (id: string) => {
      const s = sesiones.get(id);
      if (!s) return;
      limpiarTimeouts();
      try {
        if (s.gemini) {
          await s.gemini.close();
        }
      } catch (e) {
        logger.warn({ error: (e as Error).message }, "Error cerrando sesión Gemini en simulador");
      }
      if (s.contextoGuardado) {
        await guardarContexto(s.userId, s.contextoGuardado, "save");
        emitirSSE(s.userId, "contexto_guardado", { contexto: s.contextoGuardado });
      } else if (s.conversacionBuffer.length >= 3) {
        const parcial = s.conversacionBuffer.join("\n");
        await db.businessMemory.create({
          data: { userId: s.userId, rawContext: parcial, status: "borrador" },
        });
        logger.info({ userId: s.userId, lineas: s.conversacionBuffer.length }, "Contexto parcial guardado por cierre inesperado");
        emitirSSE(s.userId, "contexto_guardado", { contexto: parcial, parcial: true });
      }
      if (s.transcripts.length > 0) {
        await db.callTranscript.createMany({
          data: s.transcripts.map((t) => ({
            callSid,
            userId: s.userId,
            rol: t.rol,
            texto: t.texto,
            ts: new Date(t.ts),
          })),
        });
      }
      sesiones.delete(id);
    };

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.tipo === "audio" && msg.base64 && sesion.gemini) {
          await sesion.gemini.sendRealtimeInput({
            media: { data: msg.base64, mimeType: msg.mimeType || "audio/pcm;rate=16000" },
          });
          resetearTimeouts();
          return;
        }

        if (msg.tipo === "iniciar") {
          await iniciarSesionGemini(sesion, callSid);
          resetearTimeouts();
          return;
        }

        if (msg.tipo === "detener") {
          await cerrarSimulador(callSid);
          return;
        }
      } catch (e) {
        logger.error({ error: (e as Error).message }, "Error en mensaje WebSocket simulador");
      }
    });

    ws.on("close", async () => {
      logger.info({ userId }, "Simulador desconectado");
      await cerrarSimulador(callSid);
    });

    ws.on("error", async (e) => {
      logger.error({ error: e.message, userId }, "Error WebSocket simulador");
      await cerrarSimulador(callSid);
    });
  });
}

function enviarTexto(ws: WebSocket, texto: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ tipo: "texto", texto }));
}

function enviarAudio(ws: WebSocket, base64: string, mimeType: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ tipo: "audio", base64, mimeType }));
}

async function iniciarSesionGemini(sesion: SesionSimulador, callSid: string): Promise<void> {
  if (!ai) {
    enviarTexto(sesion.ws, "Modo demo: GEMINI_API_KEY no configurada. Usa el textarea para editar el contexto manualmente.");
    return;
  }

  try {
    const contexto = await obtenerContextoNegocio(sesion.userId);
    const settings = await db.businessSettings.findUnique({ where: { userId: sesion.userId } });
    const idioma = settings?.aiLanguage || "es";

    const systemPrompt = construirPromptEntrevista(contexto, idioma);

const liveConnect = ai.live.connect as any;
    const sessionResult = await liveConnect({
      model: MODELO,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ functionDeclarations: obtenerHerramientasSimulador(sesion, callSid)[0].functionDeclarations }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
      callbacks: {
        onopen: () => {
          logger.info({ callSid }, "Simulador Gemini session opened");
        },
        onclose: () => {
          logger.info({ callSid }, "Simulador Gemini session closed");
        },
        onerror: (error: any) => {
          logger.error({ error: error?.message || String(error), callSid }, "Simulador Gemini session error");
        },
        onmessage: (message: any) => {
          // Mensajes se procesan en procesarRespuestasGemini
        },
      },
    });

    const session = sessionResult as Session;

    sesion.gemini = session as Session;
    enviarTexto(sesion.ws, "Conectado a Gemini. Iniciando...");

    // Forzar a que la IA hable primero (Opening Prompt oculto)
    try {
      await session.send({ parts: [{ text: "Saluda amablemente e inicia la entrevista haciendo la primera pregunta." }] } as any);
    } catch (e) {
      logger.warn({ error: (e as Error).message }, "Error enviando prompt inicial a Gemini");
    }

    procesarRespuestasGemini(session as Session, sesion, callSid);
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error iniciando sesión Gemini simulador");
    enviarTexto(sesion.ws, "Error conectando con la IA. Intenta de nuevo.");
  }
}

function construirPromptEntrevista(contexto: string, idioma: string): string {
  const tieneContexto = contexto && contexto.length > 10;

  if (tieneContexto) {
    return `
Eres un entrevistador amable para ayudar a dueños de negocios a configurar su asistente de voz IA.

## CONTEXTO ACTUAL
${contexto}

## INSTRUCCIONES
- Tu rol es ACTUALIZAR el contexto existente.
- Empieza diciendo: "Ya tengo información de tu negocio. ¿Qué partes quieres actualizar o agregar? También podemos empezar desde cero si prefieres."
- Si el usuario dice "empezar de cero", responde con "REINICIAR_CONTEXTO" y luego entrevista normalmente.
- Si el usuario quiere cambiar algo específico, actualiza solo esa parte.
- Cuando tengas suficiente información, pregunta: "¿Esto sería todo? Te doy un resumen de lo que tenemos hasta ahora."
- Si el usuario confirma, llama a la herramienta guardar_contexto.
- Habla en ${idioma === "es" ? "español" : "inglés"}.
    `.trim();
  }

  return `
Eres un entrevistador amable para ayudar a dueños de negocios a configurar su asistente de voz IA.

## INSTRUCCIONES
- Tu objetivo es extraer TODA la información del negocio del usuario.
- Haz preguntas una por una, de forma natural.
- Pregunta sobre: tipo de negocio, servicios y precios, horarios, recursos, políticas, datos del cliente a recopilar, tono deseado.
- Cuando tengas suficiente información, da un resumen y pregunta: "¿Esto sería todo? Te doy un resumen de lo que tenemos hasta ahora."
- Si el usuario confirma, llama a la herramienta guardar_contexto.
- Sé amable, profesional y conciso.
- Habla en ${idioma === "es" ? "español" : "inglés"}.
  `.trim();
}

function obtenerHerramientasSimulador(
  sesion: SesionSimulador,
  callSid: string
): Array<{ functionDeclarations: Array<{ name: string; description: string; parameters: { type: Type.OBJECT; properties: Record<string, any>; required: string[] } }> }> {
  return [
    {
      functionDeclarations: [
        {
          name: "guardar_contexto",
          description:
            "Guarda el contexto del negocio. Solo usar cuando el usuario confirme que la información está completa.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              raw_context: {
                type: Type.STRING,
                description: "Resumen completo del contexto del negocio en texto plano estructurado.",
              },
            },
            required: ["raw_context"],
          },
        },
      ],
    },
  ];
}

async function procesarRespuestasGemini(
  session: Session,
  sesion: SesionSimulador,
  callSid: string
): Promise<void> {
  try {
    for await (const message of session as any) {
      const parts = message.serverContent?.modelTurn?.parts;
      if (!parts) continue;

      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("audio/")) {
          enviarAudio(sesion.ws, part.inlineData.data!, part.inlineData.mimeType);
        }

        if (part.text) {
          if (part.text.includes("REINICIAR_CONTEXTO")) {
            const textoLimpio = part.text.replace("REINICIAR_CONTEXTO", "").trim();
            if (textoLimpio) enviarTexto(sesion.ws, textoLimpio);
            sesion.contextoGuardado = null;
            sesion.conversacionBuffer = [];
            continue;
          }
          enviarTexto(sesion.ws, part.text);
          sesion.conversacionBuffer.push(`IA: ${part.text}`);
          sesion.transcripts.push({ texto: part.text, rol: "ai", ts: Date.now() });
          emitirSSE(sesion.userId, "transcripcion", { texto: part.text, rol: "ai" });
          logger.info({ texto: part.text }, "Transcripción simulador IA");
        }

        if (part.functionCall) {
          const { name, args } = part.functionCall;
          if (name === "guardar_contexto") {
            const rawContext = (args as Record<string, unknown>).raw_context as string;
            sesion.contextoGuardado = rawContext;
            enviarTexto(sesion.ws, "¡Contexto guardado! Puedes editarlo en el panel y volver a guardar.");
            await guardarContexto(sesion.userId, rawContext, "save");
            emitirSSE(sesion.userId, "contexto_guardado", { contexto: rawContext });
            logger.info({ userId: sesion.userId }, "Contexto guardado desde simulador");
          }

          await session.sendRealtimeInput({
            functionResponses: [
              {
                name: name!,
                response: { ok: true },
              },
            ],
          } as any);
        }
      }

      if (message.serverContent?.turnComplete) {
        logger.info({ callSid }, "Turno Gemini simulador completado");
      }
    }
  } catch (e) {
    logger.error({ error: (e as Error).message, callSid }, "Error en loop Gemini simulador");
    enviarTexto(sesion.ws, "Error en la conexión con la IA. Puedes seguir editando el contexto manualmente.");
  }
}
