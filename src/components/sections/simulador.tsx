"use client";

import * as React from "react";
import {
  Mic,
  Square,
  Play,
  RefreshCw,
  Save,
  Brain,
  MessageSquare,
  Sparkles,
  Info,
  Wifi,
  WifiOff,
  Code,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient } from "@/lib/api";
import { MicButton } from "@/components/voice/MicButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Mensaje {
  rol: "ai" | "user";
  texto: string;
  ts: number;
}

type EstadoSesion = "idle" | "iniciada" | "comienza" | "escuchando" | "procesando" | "ia_hablando";

const TEXTO_ESTADO: Record<Exclude<EstadoSesion, "idle">, string> = {
  iniciada: "Asistente personal de configuración iniciada.",
  comienza: "Comienza a hablar ahora.",
  escuchando: "Escuchando...",
  procesando: "Procesando tu respuesta...",
  ia_hablando: "IA hablando...",
};

export function SimuladorSection() {
  const { usuario } = useAppStore();
  const [grabando, setGrabando] = React.useState(false);
  const [estadoSesion, setEstadoSesion] = React.useState<EstadoSesion>("idle");
  const [conectado, setConectado] = React.useState(false);
  const [mensajes, setMensajes] = React.useState<Mensaje[]>([]);
  const [contextoExtraido, setContextoExtraido] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [timer, setTimer] = React.useState(0);
  const wsRef = React.useRef<WebSocket | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const wsUrlRef = React.useRef("");

  React.useEffect(() => {
    if (!usuario) return;
    ApiClient.get<{ memoria: { rawContext: string } | null }>(
      `/api/business-memory?userId=${usuario.id}`
    ).then((data) => {
      if (data.memoria?.rawContext) {
        setContextoExtraido(data.memoria.rawContext);
      }
    });
  }, [usuario]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  // Al desmontar (navegar fuera de la página) cierra el WS: sin esto la
  // sesión vieja quedaba viva en el backend y seguía sonando ("dos bots").
  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!grabando) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [grabando]);

  const conectarWS = () => {
    if (!usuario) return null;
    const { token } = useAppStore.getState();
    const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_WS_URL!;
    const wsHost = host.replace(/^http/, "ws");
    const url = `${wsHost}/stream/sim?user_id=${usuario.id}&token=${token || "dev"}`;
    wsUrlRef.current = url;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConectado(true);
      ws.send(JSON.stringify({ tipo: "iniciar" }));
    };

    // --- MOTOR DE REPRODUCCIÓN DE AUDIO ---
    let audioContext: AudioContext | null = null;
    let nextPlayTime = 0;

    const initAudio = () => {
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
    };

    const queueAudio = async (base64Data: string) => {
      initAudio();
      if (audioContext!.state === 'suspended') await audioContext!.resume();

      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x7FFF;

      const buffer = audioContext!.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = audioContext!.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext!.destination);

      if (nextPlayTime < audioContext!.currentTime) {
        nextPlayTime = audioContext!.currentTime;
      }
      source.start(nextPlayTime);
      nextPlayTime += buffer.duration;
      setEstadoSesion("ia_hablando");
      // Cuando termina el último chunk encolado, volvemos a "Escuchando..."
      const finProgramado = nextPlayTime;
      source.onended = () => {
        if (audioContext && audioContext.state !== "closed" && audioContext.currentTime >= finProgramado - 0.05) {
          setEstadoSesion("escuchando");
        }
      };
    };

    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.tipo === "texto") {
          setMensajes((prev) => [...prev, { rol: "ai", texto: msg.texto, ts: Date.now() }]);
        } else if (msg.tipo === "audio" && msg.base64) {
          await queueAudio(msg.base64);
        } else if (msg.tipo === "interrumpir") {
          // Si el servidor avisa que el usuario interrumpió, limpiamos el audio pendiente
          if (audioContext && audioContext.state !== "closed") {
            audioContext.close();
            audioContext = null;
          }
          nextPlayTime = 0;
          setEstadoSesion("escuchando");
        } else if (msg.tipo === "estado") {
          if (msg.estado === "escuchando" || msg.estado === "procesando") {
            setEstadoSesion(msg.estado);
          }
        } else if (msg.tipo === "contexto") {
          if (typeof msg.contexto === "string") {
            setContextoExtraido(msg.contexto);
          }
        } else if (msg.tipo === "listo") {
          setGrabando(true);
          setEstadoSesion("iniciada");
          setTimeout(() => {
            setEstadoSesion((prev) => (prev === "iniciada" ? "comienza" : prev));
          }, 1800);
          toast.info("Micrófono activo. El asistente te guiará en la configuración.");
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setConectado(false);
      setGrabando(false);
      setEstadoSesion("idle");
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
    };

    ws.onerror = () => {
      setConectado(false);
      toast.error("Error de conexión con el servidor de voz");
    };

    return ws;
  };

  const iniciarGrabacion = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setMensajes([]);
    setTimer(0);
    setEstadoSesion("idle");
    // No grabamos inmediatamente, esperamos el evento "listo" del servidor
    setConectado(true);
    const ws = conectarWS();
    if (!ws) {
      toast.error("No se pudo conectar");
      setConectado(false);
      return;
    }
  };

  const detenerGrabacion = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ tipo: "detener" }));
      toast.info("Guardando información, espera un momento...");
    }
    setGrabando(false);
    setConectado(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const enviarAudio = (base64: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo: "audio", base64, mimeType: "audio/pcm;rate=16000" }));
    }
  };

  const guardarContexto = async () => {
    if (!usuario || !contextoExtraido.trim()) return;
    setGuardando(true);
    try {
      await ApiClient.post("/api/simulator", {
        userId: usuario.id,
        rawContext: contextoExtraido,
        action: "save",
      });
      toast.success("Información de tu negocio guardada correctamente");
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const reiniciar = async () => {
    if (!usuario) return;
    if (!confirm("¿Archivar la versión actual y empezar una nueva entrevista?")) return;
    try {
      await ApiClient.post("/api/simulator", {
        userId: usuario.id,
        rawContext: contextoExtraido,
        action: "reinterview",
      });
      setMensajes([]);
      setContextoExtraido("");
      setTimer(0);
      toast.success("Versión archivada. Lista para nueva entrevista.");
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const formatTiempo = (s: number) => {
    const m = Math.floor(s / 60);
    const seg = s % 60;
    return `${m.toString().padStart(2, "0")}:${seg.toString().padStart(2, "0")}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
      {/* Tarjeta de Entrevista */}
      <Card className="flex flex-col h-[600px] shadow-sm border-muted/60 overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-50" />
        
        <CardHeader className="pb-4 border-b border-border/50 bg-background/50 backdrop-blur-sm z-10">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                Entrevista con IA
              </CardTitle>
              <CardDescription className="text-sm font-medium">
                {grabando ? (
                  <span className="text-red-500 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    Grabando · {formatTiempo(timer)}
                  </span>
                ) : (
                  "Presiona el micrófono para iniciar"
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {conectado ? (
                <Badge variant="secondary" className="text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">
                  <Wifi className="h-3 w-3 mr-1.5" /> Conectado
                </Badge>
              ) : grabando ? (
                <Badge variant="secondary" className="text-xs font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">
                  <WifiOff className="h-3 w-3 mr-1.5" /> Reconectando
                </Badge>
              ) : null}
              {grabando && (
                <Button variant="destructive" size="sm" onClick={detenerGrabacion} className="h-8 shadow-sm">
                  <Square className="h-3.5 w-3.5 mr-1.5" /> Detener
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-hidden relative z-10 bg-background/20">
          <ScrollArea className="h-full absolute inset-0" ref={scrollRef as never}>
            <div className="p-5 space-y-4">
              {mensajes.length === 0 && !grabando && (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center space-y-4 p-8 animate-in fade-in duration-700">
                  <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center ring-1 ring-primary/10 shadow-sm">
                    <Mic className="h-10 w-10 text-primary/40" />
                  </div>
                  <div className="space-y-2 max-w-[280px]">
                    <p className="text-base font-medium text-foreground">Asistente de Configuración</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Habla naturalmente sobre tus servicios, precios y horarios. La IA se encargará del resto.
                    </p>
                  </div>
                </div>
              )}
              {mensajes.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.rol === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                      m.rol === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-white dark:bg-zinc-800 border border-border/50 rounded-bl-sm"
                    )}
                  >
                    {m.texto}
                  </div>
                </div>
              ))}
              {grabando && estadoSesion !== "idle" && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-800 border border-border/50 shadow-sm rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-3">
                    <span
                      className={cn(
                        "text-sm font-medium text-muted-foreground",
                        (estadoSesion === "iniciada" || estadoSesion === "comienza" || estadoSesion === "ia_hablando") &&
                          "animate-pulse"
                      )}
                    >
                      {TEXTO_ESTADO[estadoSesion]}
                    </span>
                    {(estadoSesion === "escuchando" || estadoSesion === "procesando") && (
                      <div className="flex gap-1.5 items-center h-4">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <div className="p-6 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm border-t border-border/50 z-10">
          {grabando ? (
            <div className="scale-110 transition-transform">
              <MicButton
                onAudioChunk={enviarAudio}
                onStart={() => {}}
                onStop={detenerGrabacion}
                autoStart
              />
            </div>
          ) : (
            <button
              onClick={iniciarGrabacion}
              className="group relative h-20 w-20 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20 group-hover:opacity-40 transition-opacity" />
              <Mic className="h-8 w-8 relative z-10" />
            </button>
          )}
        </div>
      </Card>

      {/* Tarjeta de Información */}
      <Card className="flex flex-col h-[600px] shadow-sm border-muted/60 relative overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/50 bg-background/50 backdrop-blur-sm z-10">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Brain className="h-4 w-4" />
                </div>
                Conocimiento Extraído
              </CardTitle>
              <CardDescription className="text-sm">
                Información que la IA ha aprendido de ti
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={reiniciar} 
                disabled={!contextoExtraido}
                className="h-8 shadow-sm hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reiniciar
              </Button>
              <Button 
                size="sm" 
                onClick={guardarContexto} 
                disabled={guardando || !contextoExtraido.trim()}
                className="h-8 shadow-sm"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {guardando ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-4 flex flex-col min-h-0 bg-background/20 z-10">
          {!contextoExtraido && !grabando ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-8 animate-in fade-in duration-700">
              <div className="h-20 w-20 rounded-full bg-blue-500/5 flex items-center justify-center ring-1 ring-blue-500/10 shadow-sm">
                <Code className="h-10 w-10 text-blue-500/40" />
              </div>
              <div className="space-y-2 max-w-[280px]">
                <p className="text-base font-medium text-foreground">Sin información</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Realiza la entrevista para que la IA extraiga automáticamente los detalles de tu negocio.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 relative group">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
              <Textarea
                value={contextoExtraido}
                onChange={(e) => setContextoExtraido(e.target.value)}
                className="flex-1 resize-none font-mono text-sm leading-relaxed p-5 bg-white/50 dark:bg-zinc-900/50 border-muted-foreground/20 focus-visible:ring-primary/30 focus-visible:border-primary/50 shadow-inner"
                placeholder="La información de tu negocio aparecerá estructurada aquí..."
              />
              <div className="flex items-center justify-end mt-3 text-xs font-medium text-muted-foreground">
                <span className="bg-muted px-2 py-1 rounded-md">{contextoExtraido.length} caracteres</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banner de Ayuda */}
      <Card className="lg:col-span-2 shadow-sm border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-900/50 overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
        <CardContent className="p-5 flex items-start gap-4 relative z-10">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg shrink-0">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1.5 flex-1">
            <p className="font-semibold text-blue-800 dark:text-blue-300 text-sm">
              ¿Cómo configurar tu asistente?
            </p>
            <p className="text-sm text-blue-700/80 dark:text-blue-400/80 leading-relaxed max-w-4xl">
              Inicia la grabación y permite el acceso al micrófono. El asistente te hará preguntas clave sobre los servicios que ofreces, 
              tus precios, horarios de atención y políticas. Responde con naturalidad, como si hablaras con un humano. 
              Al finalizar, generaremos automáticamente un resumen estructurado que podrás editar y guardar.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
