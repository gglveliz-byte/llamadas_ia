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

export function SimuladorSection() {
  const { usuario } = useAppStore();
  const [grabando, setGrabando] = React.useState(false);
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
    };

    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.tipo === "texto") {
          setMensajes((prev) => [...prev, { rol: "ai", texto: msg.texto, ts: Date.now() }]);
        } else if (msg.tipo === "audio" && msg.base64) {
          await queueAudio(msg.base64);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setConectado(false);
      setGrabando(false);
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
    setMensajes([]);
    setTimer(0);
    setGrabando(true);
    const ws = conectarWS();
    if (!ws) {
      toast.error("No hay sesión activa");
      setGrabando(false);
      return;
    }
    toast.info("Micrófono activo. La IA te guiará en la entrevista.");
  };

  const detenerGrabacion = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ tipo: "detener" }));
      wsRef.current.close();
      wsRef.current = null;
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="panel-wa flex flex-col h-[calc(100vh-12rem)]">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Entrevista de Voz
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {grabando ? (
                  <span className="text-red-600 font-medium flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    Grabando · {formatTiempo(timer)}
                  </span>
                ) : (
                  "Presiona el micrófono para iniciar"
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {conectado ? (
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                  <Wifi className="h-3 w-3 mr-1" /> Conectado
                </Badge>
              ) : grabando ? (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                  <WifiOff className="h-3 w-3 mr-1" /> Reconectando...
                </Badge>
              ) : null}
              {grabando && (
                <Button variant="outline" size="sm" onClick={detenerGrabacion}>
                  <Square className="h-3 w-3 mr-1" /> Detener
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef as never}>
            <div className="p-4 space-y-3">
              {mensajes.length === 0 && !grabando && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-6">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Presiona el micrófono para empezar</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      La IA te entrevistará para conocer tu negocio. Habla naturalmente.
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
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      m.rol === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {m.texto}
                  </div>
                </div>
              ))}
              {grabando && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">IA escribiendo</span>
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <div className="border-t border-border p-4 flex flex-col items-center gap-3">
          {grabando ? (
            <MicButton
              onAudioChunk={enviarAudio}
              onStart={() => {}}
              onStop={detenerGrabacion}
            />
          ) : (
            <button
              onClick={iniciarGrabacion}
              className="relative h-20 w-20 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30 flex items-center justify-center transition-all"
            >
              <Mic className="h-8 w-8" />
            </button>
          )}
        </div>
      </Card>

      <Card className="panel-wa flex flex-col h-[calc(100vh-12rem)]">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Información de tu negocio
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                La IA la recopila durante la entrevista. Puedes editarla cuando quieras.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reiniciar} disabled={!contextoExtraido}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Re-entrevistar
              </Button>
              <Button size="sm" onClick={guardarContexto} disabled={guardando || !contextoExtraido.trim()}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {guardando ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-3">
          {!contextoExtraido && !grabando ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Tu contexto aparecerá aquí</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  La IA extraerá automáticamente la información de tu negocio durante la entrevista.
                  Después podrás editarla manualmente.
                </p>
              </div>
            </div>
          ) : (
            <>
              <Textarea
                value={contextoExtraido}
                onChange={(e) => setContextoExtraido(e.target.value)}
                rows={20}
                className="h-full resize-none font-mono text-xs"
                placeholder="El contexto extraído aparecerá aquí..."
              />
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{contextoExtraido.length} caracteres</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="panel-wa lg:col-span-2 bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-blue-700 dark:text-blue-300">
              ¿Cómo funciona?
            </p>
            <p className="text-xs text-muted-foreground">
              El asistente de voz te hará una entrevista hablada. Contesta con naturalidad:
              preguntará por tus servicios, precios y horarios. Al terminar, guarda la
              información que usará en las llamadas con tus clientes.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Necesitas:</strong> permitir el acceso al micrófono.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
