"use client";

import * as React from "react";
import { useAppStore } from "@/lib/store";

/**
 * Hook para conectarse al SSE del backend Express.
 * Cumple spec sección 12.1.
 *
 * Eventos: nueva_cita, llamada_finalizada, saldo_bajo, transcripcion,
 * alerta_sistema, conexion_establecida, llamada_iniciada, recarga_exitosa.
 *
 * Usa el gateway Caddy con ?XTransformPort=3001 para llegar al Express.
 */
export function useSSE() {
  const { usuario, refreshWallet } = useAppStore();
  const [eventos, setEventos] = React.useState<Array<{ tipo: string; data: unknown; ts: number }>>([]);
  const [conectado, setConectado] = React.useState(false);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    if (!usuario) return;

    // Construir URL SSE vía proxy de Next.js (que reenvía al Express puerto 3001)
    const sseUrl = `/sse/events?user_id=${usuario.id}&token=dev`;
    console.log("[SSE] Conectando a", sseUrl);

    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("[SSE] Conexión establecida");
      setConectado(true);
    };

    // Escuchar eventos conocidos
    const tiposEvento = [
      "conexion_establecida",
      "nueva_cita",
      "llamada_iniciada",
      "llamada_finalizada",
      "saldo_bajo",
      "transcripcion",
      "alerta_sistema",
      "recarga_exitosa",
    ];

    for (const tipo of tiposEvento) {
      es.addEventListener(tipo, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          console.log(`[SSE] Evento ${tipo}:`, data);
          setEventos((prev) =>
            [...prev, { tipo, data, ts: Date.now() }].slice(-50)
          );

          // Reaccionar a eventos que afectan al wallet
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
  }, [usuario, refreshWallet]);

  return { eventos, conectado };
}
