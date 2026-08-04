import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db } from "../models/database.pool";
import { guardarContexto, obtenerContextoNegocio } from "../services/rag.service";
import { emitirSSE } from "../sse/events.emitter";
import { logger } from "../utils/logger";

const MODELO = process.env.GEMINI_MODEL || "models/gemini-3.1-flash-live-preview";

interface SesionSimulador {
  ws: WebSocket;
  userId: string;
  gemini: WebSocket | null;
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
          s.gemini.close();
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

        if (msg.tipo === "audio" && msg.base64 && sesion.gemini && sesion.gemini.readyState === WebSocket.OPEN) {
          sesion.gemini.send(JSON.stringify({
            realtimeInput: {
              audio: {
                mimeType: msg.mimeType || "audio/pcm;rate=16000",
                data: msg.base64
              }
            }
          }));
          resetearTimeouts();
          return;
        }

        if (msg.tipo === "iniciar") {
          await iniciarSesionGemini(sesion, callSid);
          resetearTimeouts();
          return;
        }

        if (msg.tipo === "detener") {
          if (sesion.gemini && sesion.gemini.readyState === WebSocket.OPEN) {
            enviarTexto(sesion.ws, "Finalizando entrevista. Guardando la configuración...");
            sesion.gemini.send(JSON.stringify({
              clientContent: {
                turns: [{
                  role: "user",
                  parts: [{ text: "INSTRUCCIÓN DEL SISTEMA: El usuario ha presionado el botón de finalizar. Resume la información recopilada hasta ahora y llama a la herramienta guardar_contexto INMEDIATAMENTE. No hagas más preguntas." }]
                }],
                turnComplete: true
              }
            }));
            // Forzar cierre tras 6 segundos para dar tiempo a que guarde
            setTimeout(() => {
              cerrarSimulador(callSid).catch(() => {});
            }, 6000);
          } else {
            await cerrarSimulador(callSid);
          }
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    enviarTexto(sesion.ws, "Modo demo: GEMINI_API_KEY no configurada. Usa el textarea para editar el contexto manualmente.");
    return;
  }

  try {
    const contexto = await obtenerContextoNegocio(sesion.userId);
    const settings = await db.businessSettings.findUnique({ where: { userId: sesion.userId } });
    const idioma = settings?.aiLanguage || "es";
    const systemPrompt = construirPromptEntrevista(contexto, idioma);
    const aiVoice = settings?.aiVoice || "Puck";

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const geminiWs = new WebSocket(wsUrl);
    sesion.gemini = geminiWs;

    geminiWs.on("open", () => {
      logger.info({ callSid }, "Simulador Gemini session opened via raw WebSocket");
      const setupMsg = {
        setup: {
          model: MODELO,
          turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: aiVoice
                }
              }
            }
          },
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [{ functionDeclarations: obtenerHerramientasSimulador() }]
        }
      };
      geminiWs.send(JSON.stringify(setupMsg));
    });

    geminiWs.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.setupComplete) {
          enviarTexto(sesion.ws, "Asistente personal de configuración iniciada.");
          setTimeout(() => {
            enviarTexto(sesion.ws, "Comienza a hablar ahora.");
          }, 500);
          return;
        }

        if (msg.serverContent) {
          if (msg.serverContent.interrupted) {
            if (sesion.ws.readyState === WebSocket.OPEN) {
              sesion.ws.send(JSON.stringify({ tipo: "interrumpir" }));
            }
          }
          if (msg.serverContent.modelTurn && msg.serverContent.modelTurn.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData && part.inlineData.mimeType?.startsWith("audio")) {
              enviarAudio(sesion.ws, part.inlineData.data, part.inlineData.mimeType);
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
                const rawContext = args.raw_context as string;
                sesion.contextoGuardado = rawContext;
                enviarTexto(sesion.ws, "¡Contexto guardado! Puedes editarlo en el panel y volver a guardar.");
                await guardarContexto(sesion.userId, rawContext, "save");
                emitirSSE(sesion.userId, "contexto_guardado", { contexto: rawContext });
                logger.info({ userId: sesion.userId }, "Contexto guardado desde simulador");
              }

              // Send function response back
              geminiWs.send(JSON.stringify({
                clientContent: {
                  turnComplete: true,
                  turns: [{
                    role: "user",
                    parts: [{
                      functionResponse: {
                        name: name,
                        response: { ok: true }
                      }
                    }]
                  }]
                }
              }));
            }
          }
        }
        }
      } catch (e) {
        logger.error({ error: (e as Error).message }, "Error procesando mensaje de Gemini");
      }
    });

    geminiWs.on("close", () => {
      logger.info({ callSid }, "Simulador Gemini session closed");
    });

    geminiWs.on("error", (error) => {
      logger.error({ error: error?.message || String(error), callSid }, "Simulador Gemini session error");
      enviarTexto(sesion.ws, "Error conectando con la IA. Intenta de nuevo.");
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error iniciando sesión Gemini simulador");
    enviarTexto(sesion.ws, "Error conectando con la IA. Intenta de nuevo.");
  }
}

function construirPromptEntrevista(contexto: string, idioma: string): string {
  const tieneContexto = contexto && contexto.length > 10;

  if (tieneContexto) {
    return `
Eres un asistente profesional encargado de configurar los detalles de un negocio para un sistema de inteligencia artificial.

## INSTRUCCIONES
- Empieza la interacción diciendo exactamente: "Hola un gusto, te ayudaré a configurar tu negocio, todo lo que se hable en esta entrevista, es la información que le diré a tus clientes al responder tus llamadas, entonces comienzo a preguntarte sobre tu negocio ¿está bien?"
- Tu único objetivo es obtener los detalles operativos del negocio. NO hables de tu stack tecnológico, ni de programación, ni de cómo estás hecho. NUNCA pierdas el foco.
- Ya existe un contexto guardado del negocio:
${contexto}
- Si el usuario menciona querer cambiar algo, actualiza solo esa parte. Si dice "empezar de cero", responde con "REINICIAR_CONTEXTO" y entrevista de nuevo.
- Cuando tengas toda la información, da un resumen final y llama a la herramienta guardar_contexto.
- Sé profesional y enfocado. Habla en ${idioma === "es" ? "español" : "inglés"}.
    `.trim();
  }

  return `
Eres un asistente profesional encargado de configurar los detalles de un negocio para un sistema de inteligencia artificial.

## INSTRUCCIONES
- Empieza la interacción diciendo exactamente: "Hola un gusto, te ayudaré a configurar tu negocio, todo lo que se hable en esta entrevista, es la información que le diré a tus clientes al responder tus llamadas, entonces comienzo a preguntarte sobre tu negocio ¿está bien?"
- Tu único objetivo es obtener los detalles operativos del negocio del usuario (servicios, horarios, precios, recursos, políticas).
- NUNCA hables de tu stack tecnológico, ni de programación, ni de detalles técnicos sobre cómo funcionas. No pierdas el foco de la configuración del negocio.
- Haz las preguntas una por una, de forma natural.
- Cuando tengas suficiente información, da un resumen y llama a la herramienta guardar_contexto.
- Sé profesional, servicial y conciso. Habla en ${idioma === "es" ? "español" : "inglés"}.
  `.trim();
}

function obtenerHerramientasSimulador(): Array<any> {
  return [
    {
      name: "guardar_contexto",
      description: "Guarda el contexto del negocio. Solo usar cuando el usuario confirme que la información está completa.",
      parameters: {
        type: "OBJECT",
        properties: {
          raw_context: {
            type: "STRING",
            description: "Resumen completo del contexto del negocio en texto plano estructurado.",
          },
        },
        required: ["raw_context"],
      },
    }
  ];
}
