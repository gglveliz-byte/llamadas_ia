"use client";

import * as React from "react";
import { Mic, Loader2 } from "lucide-react";
import { ApiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function MobileSimuladorPage() {
  const [grabando, setGrabando] = React.useState(false);
  const [conectando, setConectando] = React.useState(false);
  const [contexto, setContexto] = React.useState("");
  const [usuario, setUsuario] = React.useState<{ id: string; businessName?: string } | null>(null);
  const [transcripcion, setTranscripcion] = React.useState<string[]>([]);
  const wsRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    ApiClient.get<{ user: { id: string; businessName?: string } }>("/api/session")
      .then((d) => setUsuario(d.user))
      .catch(() => {});
  }, []);

  const iniciar = async () => {
    if (!usuario) return;
    setConectando(true);
    setTranscripcion([]);

    const token = document.cookie
      .split("; ")
      .find((r) => r.startsWith("vozia-token="))
      ?.split("=")[1];

    const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
    const wsUrl = token
      ? `${wsBase}/stream/sim?token=${token}`
      : `${wsBase}/stream/sim?user_id=${usuario.id}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConectando(false);
        setGrabando(true);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "transcripcion") {
            setTranscripcion((p) => [...p, `IA: ${msg.texto}`]);
          } else if (msg.type === "contexto_guardado") {
            setContexto(msg.resumen || "");
            setTranscripcion((p) => [...p, "✅ Contexto guardado correctamente"]);
          } else if (msg.type === "error") {
            setTranscripcion((p) => [...p, `❌ Error: ${msg.mensaje}`]);
          } else if (msg.texto) {
            setTranscripcion((p) => [...p, `IA: ${msg.texto}`]);
          }
        } catch {
          // probablmente audio binario
        }
      };

      ws.onclose = () => {
        setGrabando(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        setConectando(false);
        setTranscripcion((p) => [...p, "❌ Error de conexión"]);
      };
    } catch {
      setConectando(false);
    }
  };

  const detener = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setGrabando(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#0b141a]">
      <header className="px-4 py-3 border-b border-white/10 bg-white/80 dark:bg-[#1f2c33]/80 backdrop-blur-sm">
        <h1 className="text-lg font-bold">Simulador de Voz</h1>
        <p className="text-xs text-muted-foreground">
          {usuario?.businessName ?? "VozIA"} · Móvil
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {contexto && (
          <div className="bg-white dark:bg-[#1f2c33] rounded-xl p-4 border border-slate-200 dark:border-white/[0.08]">
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              Contexto actual
            </h2>
            <p className="text-sm whitespace-pre-wrap line-clamp-6">{contexto}</p>
          </div>
        )}

        {transcripcion.length === 0 && !grabando && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Mic className="h-12 w-12 mb-4 opacity-20" />
            <p>Presiona el botón para iniciar la entrevista de voz</p>
            <p className="text-xs mt-2">La IA te hará preguntas sobre tu negocio</p>
          </div>
        )}

        {transcripcion.length > 0 && (
          <div className="space-y-3">
            {transcripcion.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "p-3 rounded-xl text-sm max-w-[85%]",
                  t.startsWith("IA:")
                    ? "bg-white dark:bg-[#1f2c33] border border-slate-200 dark:border-white/[0.08] self-start"
                    : t.startsWith("❌") || t.startsWith("✅")
                    ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-center w-full"
                    : t.startsWith("Error")
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30"
                    : "bg-primary/10 border border-primary/20 ml-auto"
                )}
              >
                {t}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-6 flex justify-center relative">
        {conectando && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <button
          onClick={grabando ? detener : iniciar}
          disabled={conectando || !usuario}
          className={cn(
            "h-20 w-20 rounded-full flex items-center justify-center transition-all shadow-xl",
            grabando
              ? "bg-red-500 text-white shadow-red-500/40 scale-110"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/30"
          )}
          style={{ position: "fixed", bottom: "40px", left: "50%", transform: "translateX(-50%)" }}
        >
          {conectando ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : grabando ? (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-red-300 animate-ping" />
              <div className="flex items-end gap-1 h-8">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 bg-white rounded-full animate-wave"
                    style={{ animationDelay: `${i * 0.1}s`, height: `${50 + Math.random() * 50}%` }}
                  />
                ))}
              </div>
            </>
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </button>
        {grabando && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground uppercase tracking-wider">
            Grabando...
          </span>
        )}
      </div>
    </div>
  );
}
