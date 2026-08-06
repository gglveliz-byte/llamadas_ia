import { WebSocketServer, WebSocket } from "ws";
import { RealTimeVAD } from "@ericedouard/vad-node-realtime";
import { IncomingMessage } from "http";
import { db } from "../models/database.pool";
import { guardarContexto, obtenerContextoNegocio } from "../services/rag.service";
import { emitirSSE } from "../sse/events.emitter";
import { logger } from "../utils/logger";
import { tieneVozPorEnergia } from "../services/vad.service";

const MODELO = process.env.GEMINI_MODEL || "models/gemini-3.1-flash-live-preview";

import { crearSileroVAD, BargeInGuard, vadConfigManager } from "../services/vad.service";

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
  vad?: any;
  guard?: BargeInGuard;
  vadBase: number;
  vadBoost: number;
  isSpeaking: boolean;
  silenceFrames: number;
  finalizando: boolean;
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
      isSpeaking: false,
      silenceFrames: 0,
      finalizando: false,
      vadBase: 0.62,
      vadBoost: 0.15
    };
    sesiones.set(callSid, sesion);

    const limpiarTimeouts = () => {
      if (sesion.timeoutSilencio) clearTimeout(sesion.timeoutSilencio);
      if (sesion.timeoutCierre) clearTimeout(sesion.timeoutCierre);
    };

    const resetearTimeouts = () => {
      // La actividad cancela el aviso de silencio y el cierre por inactividad,
      // pero NUNCA el cierre programado tras "detener" (finalizando = true).
      if (sesion.timeoutSilencio) clearTimeout(sesion.timeoutSilencio);
      if (!sesion.finalizando && sesion.timeoutCierre) clearTimeout(sesion.timeoutCierre);
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
        if (s.vad) {
          s.vad.liberar?.();
          s.vad = null;
        }
        if (s.gemini) {
          s.gemini.close();
          s.gemini = null;
        }
        // Cierra también el WS del cliente: el frontend vuelve a idle y no
        // queda un socket huérfano reproduciendo audio de sesiones viejas.
        s.ws.close();
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

    // Cierra sesiones previas del mismo usuario para evitar sesiones Gemini
    // fugadas y "dos bots" sonando a la vez tras reconexiones.
    for (const [idPrevio, sPrevio] of sesiones) {
      if (idPrevio !== callSid && sPrevio.userId === userId) {
        logger.info({ userId, callSidPrevio: idPrevio }, "Cerrando sesión previa del simulador (mismo usuario)");
        cerrarSimulador(idPrevio).catch(() => {});
      }
    }

    // Inicializar Silero VAD dinámico (16kHz del navegador) con guardia anti-eco.
    // SIN await: un await aquí cedería el event loop y el "iniciar" que el
    // cliente envía al abrir llegaría antes de registrar ws.on("message").
    vadConfigManager.getConfig().then((vadCfg) => {
      sesion.vadBase = vadCfg.vad_base_threshold || 0.62;
      sesion.vadBoost = vadCfg.vad_noise_boost ?? 0.15;
      sesion.guard = new BargeInGuard(
        vadCfg.vad_ai_speaking_window ?? 250,
        vadCfg.vad_ignore_audio_until ?? 500
      );
      return crearSileroVAD(
      () => {
        const s = sesiones.get(callSid);
        if (!s || s.finalizando) return; // entrevista terminada: sin barge-in
        if (s.guard?.debeIgnorarSpeechStart()) {
          logger.debug({ callSid }, "🔇 Barge-in ignorado (eco inicial o sordera post-interrupción)");
          return;
        }
        s.guard?.registrarInterrupcion();
        if (s && s.gemini && s.gemini.readyState === WebSocket.OPEN) {
          logger.info("🎤 Usuario empezó a hablar (Silero ML) -> Interrumpiendo IA");
          s.gemini.send(JSON.stringify({ clientContent: { turns: [], turnComplete: false } }));
        }
        // El cliente detiene de inmediato el audio encolado (sin esperar el
        // "interrupted" de Gemini, que llega tarde) y muestra "Escuchando...".
        if (s && s.ws.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ tipo: "interrumpir" }));
          s.ws.send(JSON.stringify({ tipo: "estado", estado: "escuchando" }));
        }
      },
      () => {
        const s = sesiones.get(callSid);
        if (!s || s.finalizando) return;
        if (s && s.gemini && s.gemini.readyState === WebSocket.OPEN) {
          logger.info("🛑 Usuario terminó de hablar (Silero ML) -> IA procesando respuesta");
          s.gemini.send(JSON.stringify({ clientContent: { turns: [], turnComplete: true } }));
        }
        if (s && s.ws.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ tipo: "estado", estado: "procesando" }));
        }
      },
      16000
      );
    }).then(vad => {
      if (vad && sesiones.has(callSid)) {
        sesiones.get(callSid)!.vad = vad;
      }
    }).catch((e) => {
      logger.error({ error: (e as Error).message, callSid }, "Error inicializando VAD del simulador");
    });

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.tipo === "audio" && msg.base64 && sesion.gemini && sesion.gemini.readyState === WebSocket.OPEN) {
          if (sesion.finalizando) return;
          try {
            const buffer = Buffer.from(msg.base64, "base64");
            const int16 = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
            
            if (sesion.vad) {
              const float32 = new Float32Array(int16.length);
              for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 32768.0;
              }
              // Umbral adaptativo (vad_noise_boost): más estricto mientras la IA habla
              sesion.vad.setUmbral(
                sesion.guard?.iaHablando()
                  ? Math.min(1, sesion.vadBase + sesion.vadBoost)
                  : sesion.vadBase
              );
              sesion.vad.process(float32);
            }
          } catch (e) {
            logger.warn({ error: (e as Error).message }, "Error procesando VAD");
          }

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
          await iniciarSesionGemini(sesion, callSid, cerrarSimulador);
          resetearTimeouts();
          return;
        }

        if (msg.tipo === "detener") {
          sesion.finalizando = true;
          limpiarTimeouts();
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
            logger.info({ action: "finalizar" }, "🛠️ IA usando herramienta de finalización");
            if (sesion.timeoutCierre) clearTimeout(sesion.timeoutCierre);
            sesion.timeoutCierre = setTimeout(() => {
              cerrarSimulador(callSid).catch(() => {});
            }, 20000);
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

async function iniciarSesionGemini(sesion: SesionSimulador, callSid: string, cerrarSimulador: (id: string) => Promise<void>): Promise<void> {
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

    // Si ya había una sesión Gemini viva (reintento / "iniciar" duplicado),
    // cerrarla antes para que no queden dos bots respondiendo a la vez.
    if (sesion.gemini) {
      try {
        sesion.gemini.close();
      } catch (e) {
        logger.warn({ error: (e as Error).message }, "Error cerrando sesión Gemini previa");
      }
      sesion.gemini = null;
    }

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const geminiWs = new WebSocket(wsUrl);
    sesion.gemini = geminiWs;

    geminiWs.on("open", () => {
      logger.info({ callSid }, "Simulador Gemini session opened via raw WebSocket");
      logger.info("🤖 IA iniciada y lista para escuchar (Simulador)");
      const setupMsg = {
        setup: {
          model: MODELO,
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
        // debug: sessionResumptionUpdate/serverContent llegan cientos de veces por minuto
        logger.debug({ msgType: Object.keys(msg)[0] }, "Mensaje crudo recibido de Gemini");

        if (msg.setupComplete) {
          // El frontend secuencia los estados de UI ("iniciada" → "comienza a
          // hablar") al recibir "listo"; ya no se envían como texto de chat.
          if (sesion.ws.readyState === WebSocket.OPEN) {
            sesion.ws.send(JSON.stringify({ tipo: "listo" }));
          }
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
              sesion.guard?.registrarVozIA();
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
          }
        }
        }
        
        if (msg.toolCall && msg.toolCall.functionCalls) {
          for (const call of msg.toolCall.functionCalls) {
            logger.info({ tool: call.name }, "🛠️ IA usa herramienta");
            if (call.name === "guardar_contexto") {
              const rawContext = call.args.raw_context as string;
              sesion.contextoGuardado = rawContext;
              enviarTexto(sesion.ws, "¡Contexto guardado! Puedes editarlo en el panel y volver a guardar.");
              // Actualiza el panel de contexto del frontend en vivo
              if (sesion.ws.readyState === WebSocket.OPEN) {
                sesion.ws.send(JSON.stringify({ tipo: "contexto", contexto: rawContext }));
              }
              await guardarContexto(sesion.userId, rawContext, "save");
              emitirSSE(sesion.userId, "contexto_guardado", { contexto: rawContext });
              logger.info({ userId: sesion.userId }, "Contexto guardado desde simulador");

              // La entrevista terminó: ignora audio posterior y cierra tras la
              // despedida (8s de gracia para reproducirla completa).
              sesion.finalizando = true;
              if (sesion.timeoutCierre) clearTimeout(sesion.timeoutCierre);
              sesion.timeoutCierre = setTimeout(() => {
                cerrarSimulador(callSid).catch(() => {});
              }, 8000);

            // Send function response back (Live API format)
            geminiWs.send(JSON.stringify({
              toolResponse: {
                functionResponses: [
                  {
                    id: call.id,
                    name: call.name,
                    response: { 
                      status: "success",
                      voice_instruction: "El contexto se guardó correctamente. Di exactamente: '¡Listo! He guardado toda la información de tu negocio. Hasta luego.' y no digas nada más."
                    }
                  }
                ]
              }
            }));
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
- NUNCA inventes información del negocio; si no entiendes algo, pregunta de nuevo en lugar de suponer.
- Antes de llamar a guardar_contexto, di una frase breve para cubrir la espera, variando sinónimos: "Un momento, por favor", "Permíteme un segundo", "Voy a guardar toda esta información". Después retoma con la confirmación.
- Sé profesional y enfocado. Habla en ${idioma === "es" ? "español" : "inglés"}.
    `.trim();
  }

  return `
Eres un asistente profesional encargado de configurar los detalles de un negocio para un sistema de inteligencia artificial.

## INSTRUCCIONES
- Empieza la interacción diciendo exactamente: "Hola un gusto, te ayudaré a configurar tu negocio, todo lo que se hable en esta entrevista, es la información que le diré a tus clientes al responder tus llamadas, entonces comienzo a preguntarte sobre tu negocio ¿está bien?"
- Tu único objetivo es obtener los detalles operativos del negocio del usuario (servicios, horarios, precios, recursos, políticas).
- Si te dicen "listo", "me gusta", "guárdalo", "ya terminé", o confirman que el resumen está bien, DEBES llamar OBLIGATORIAMENTE a la función guardar_contexto enviando todo el resumen en texto plano en el parámetro 'raw_context'.
- NUNCA hables de tu stack tecnológico, ni de programación, ni de detalles técnicos sobre cómo funcionas. No pierdas el foco de la configuración del negocio.
- NUNCA inventes información del negocio; si no entiendes algo, pregunta de nuevo en lugar de suponer.
- Antes de llamar a guardar_contexto, di una frase breve para cubrir la espera, variando sinónimos: "Un momento, por favor", "Permíteme un segundo", "Voy a guardar toda esta información". Después retoma con la confirmación.
- Haz las preguntas una por una, de forma natural.
- Sé profesional, servicial y conciso. Habla en ${idioma === "es" ? "español" : "inglés"}.
  `.trim();
}

function obtenerHerramientasSimulador(): Array<any> {
  return [
    {
      name: "guardar_contexto",
      description: "Guarda el contexto del negocio. Úsala OBLIGATORIAMENTE cuando el usuario confirme que la información está completa o diga 'me gusta'.",
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
