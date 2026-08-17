"use client";

import * as React from "react";
import { useAppStore } from "@/lib/store";

export function useSSE() {
  const { usuario, token, refreshWallet } = useAppStore();
  const [eventos, setEventos] = React.useState<Array<{ tipo: string; data: unknown; ts: number }>>([]);
  const [conectado, setConectado] = React.useState(false);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    if (!usuario) return;

    const sseToken = token || "dev";
    const sseUrl = `/sse/events?user_id=${usuario.id}&token=${sseToken}`;
    console.log("[SSE] Conectando a", sseUrl);

    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("[SSE] Conexión establecida");
      setConectado(true);
    };

    const tiposEvento = [
      "conexion_establecida",
      "nueva_cita",
      "llamada_iniciada",
      "llamada_finalizada",
      "saldo_bajo",
      "transcripcion",
      "alerta_sistema",
      "recarga_exitosa",
      "estado_llamada",
    ];

    for (const tipo of tiposEvento) {
      es.addEventListener(tipo, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          console.log(`[SSE] Evento ${tipo}:`, data);
          setEventos((prev) =>
            [...prev, { tipo, data, ts: Date.now() }].slice(-50)
          );

          if (tipo === "llamada_finalizada" || tipo === "recarga_exitosa") {
            refreshWallet();
          }
        } catch (err) {
          console.error("[SSE] Error parseando evento:", err);
        }
      });
    }

    es.onerror = (e) => {
      console.warn("[SSE] Error, reintentando...", e);
      setConectado(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [usuario, token, refreshWallet]);

  return { eventos, conectado };
}
