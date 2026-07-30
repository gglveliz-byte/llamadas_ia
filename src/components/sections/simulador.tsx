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
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient } from "@/lib/api";
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

const FRASES_INICIALES: Array<{ rol: "ai"; texto: string }> = [
  {
    rol: "ai",
    texto: "Hola, soy tu entrevistador de voz. Voy a hacerte algunas preguntas para entender tu negocio. Cuéntame, ¿qué tipo de negocio tienes?",
  },
];

const RESPUESTAS_IA = [
  "Interesante. ¿Qué servicios principales ofreces y a qué precio?",
  "Perfecto. ¿Cuál es tu horario de atención?",
  "¿Tienes algún recurso específico que deba gestionar? Por ejemplo: sillas, doctores, habitaciones.",
  "¿Hay alguna regla o política importante que deba conocer? Por ejemplo: cancelaciones, pagos, mascotas.",
  "¿En qué zona horaria y ciudad estás ubicado?",
  "¿Algo más que deba saber para representar bien tu negocio? Tómame los datos de contacto del cliente que necesitas pedir.",
  "Excelente. Te doy un resumen de lo que tengo hasta ahora. ¿Está completo o falta algo?",
];

export function SimuladorSection() {
  const { usuario } = useAppStore();
  const [grabando, setGrabando] = React.useState(false);
  const [mensajes, setMensajes] = React.useState<Mensaje[]>(FRASES_INICIALES);
  const [contextoExtraido, setContextoExtraido] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [timer, setTimer] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const countdownRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cargar contexto actual si existe
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

  // Auto-scroll
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  // Timer
  React.useEffect(() => {
    if (!grabando) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [grabando]);

  const iniciarGrabacion = async () => {
    setGrabando(true);
    setTimer(0);
    setMensajes(FRASES_INICIALES);
    toast.info("🎙️ Entrevista iniciada. La IA te guiará para extraer el contexto de tu negocio.");

    // Simular conversación: cada 4s la IA pregunta algo nuevo
    let paso = 0;
    countdownRef.current = setInterval(() => {
      if (paso < RESPUESTAS_IA.length) {
        // Simular respuesta del usuario
        const respuestasUsuario = [
          "Tengo una barbería en Polanco, CDMX.",
          "Corte clásico $200, fade $250, barba $120.",
          "Lunes a viernes de 9 a 19, sábados de 9 a 15.",
          "Tengo 3 sillas de barbero.",
          "Cancelaciones con 2h de anticipación. No mascotas.",
          "Estoy en zona horaria de Ciudad de México.",
          "Pido nombre y teléfono al cliente. Aceptamos efectivo y tarjeta.",
          "Sí, está completo.",
        ];
        if (paso < respuestasUsuario.length) {
          setMensajes((prev) => [
            ...prev,
            { rol: "user", texto: respuestasUsuario[paso], ts: Date.now() },
          ]);
        }
        setTimeout(() => {
          setMensajes((prev) => [
            ...prev,
            { rol: "ai", texto: RESPUESTAS_IA[paso], ts: Date.now() },
          ]);
        }, 800);
        paso++;
      } else {
        // Generar contexto extraído
        const contexto = `Barbería en Polanco, CDMX. Zona horaria: America/Mexico_City.

## SERVICIOS Y PRECIOS
- Corte clásico: $200
- Fade: $250
- Barba: $120
- Diseño: $80 (mencionado en entrevista previa)

## HORARIOS
- Lunes a viernes: 9:00 - 19:00
- Sábados: 9:00 - 15:00
- Domingos: cerrado

## RECURSOS
- 3 sillas de barbero: Silla 1, Silla 2, Silla 3

## POLÍTICAS
- Cancelaciones con 2 horas de anticipación
- No se permiten mascotas
- Aceptamos efectivo y tarjeta

## DATOS DEL CLIENTE A RECOPILAR
- Nombre completo (obligatorio)
- Teléfono (opcional)
- Notas adicionales (opcional)

## TONO
Amable, profesional, conciso. Saludo inicial: "¡Hola! Gracias por llamar a [nombre barbería]."`;
        setContextoExtraido(contexto);
        detenerGrabacion();
        toast.success("✅ Contexto extraído. Revísalo y guarda.");
      }
    }, 4000);
  };

  const detenerGrabacion = () => {
    setGrabando(false);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
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
      toast.success("Contexto guardado y embebido (RAG actualizado)");
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
      setMensajes(FRASES_INICIALES);
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
      {/* Panel izquierdo: Conversación */}
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
            {grabando && (
              <Button variant="outline" size="sm" onClick={detenerGrabacion}>
                <Square className="h-3 w-3 mr-1" /> Detener
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef as never}>
            <div className="p-4 space-y-3">
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

        {/* Botón micrófono fijo */}
        <div className="border-t border-border p-4 flex flex-col items-center gap-3">
          <button
            onClick={grabando ? detenerGrabacion : iniciarGrabacion}
            className={cn(
              "relative h-20 w-20 rounded-full flex items-center justify-center transition-all",
              grabando
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30"
            )}
          >
            {grabando ? (
              <>
                {/* Ondas animadas */}
                <div className="absolute inset-0 rounded-full border-2 border-red-300 animate-ping" />
                <div className="flex items-end gap-1 h-8">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="wa-wave-bar w-1 bg-white rounded-full"
                      style={{
                        height: "100%",
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
          <span className="text-xs text-muted-foreground">
            {grabando ? "Hablando... click para detener" : "Click para iniciar entrevista"}
          </span>
        </div>
      </Card>

      {/* Panel derecho: Contexto extraído */}
      <Card className="panel-wa flex flex-col h-[calc(100vh-12rem)]">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Contexto Extraído (RAG)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Editable. Se re-embebe al guardar.
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
                <Badge variant="outline" className="text-[10px]">
                  768-dim embedding
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Info banner */}
      <Card className="panel-wa lg:col-span-2 bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-blue-700 dark:text-blue-300">
              ¿Cómo funciona el simulador?
            </p>
            <p className="text-xs text-muted-foreground">
              En producción, este componente abre un WebSocket con el backend Express, que a su vez
              conecta con <strong>Gemini 3.1 Flash Live</strong> para streaming bidireccional de audio.
              La IA actúa como entrevistadora, hace preguntas para extraer toda la información del
              negocio, y al confirmar el usuario, llama a la herramienta <code className="font-mono bg-muted px-1 rounded">guardar_contexto</code>{" "}
              que persiste el texto y genera el embedding 768-dimensional con <code className="font-mono bg-muted px-1 rounded">gemini-embedding-001</code>{" "}
              para búsquedas RAG al inicio de cada llamada.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Demo:</strong> aquí se simula la conversación con respuestas pre-definidas
              para mostrar el flujo completo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
