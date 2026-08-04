"use client";

import * as React from "react";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type EstadoGrabacion = "idle" | "solicitando" | "grabando" | "error";

interface MicButtonProps {
  onAudioChunk: (base64: string) => void;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  className?: string;
  autoStart?: boolean;
}

const CHUNK_INTERVAL_MS = 100;

export function MicButton({ onAudioChunk, onStart, onStop, disabled, className, autoStart }: MicButtonProps) {
  const [estado, setEstado] = React.useState<EstadoGrabacion>("idle");
  const [error, setError] = React.useState("");
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = React.useRef<ScriptProcessorNode | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = React.useRef<Float32Array[]>([]);
  const autoStartedRef = React.useRef(false);

  const toggleGrabacion = async () => {
    if (estado === "grabando") {
      detenerGrabacion();
      return;
    }

    setEstado("solicitando");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      intervalRef.current = setInterval(() => {
        if (chunksRef.current.length === 0) return;
        const concat = concatenarChunks(chunksRef.current);
        chunksRef.current = [];
        
        // Convert Float32 to Int16 (RAW PCM)
        const pcm16 = new Int16Array(concat.length);
        for (let i = 0; i < concat.length; i++) {
          const s = Math.max(-1, Math.min(1, concat[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const base64 = bufferToBase64(pcm16.buffer);
        onAudioChunk(base64);
      }, CHUNK_INTERVAL_MS);

      setEstado("grabando");
      onStart();
    } catch (e) {
      const mensaje = (e as Error).name === "NotAllowedError"
        ? "Permiso de micrófono denegado"
        : (e as Error).message;
      setError(mensaje);
      setEstado("error");
    }
  };

  const detenerGrabacion = () => {
    setEstado("idle");

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    onStop();
  };

  // Auto-start recording on mount if autoStart is true
  React.useEffect(() => {
    if (autoStart && !autoStartedRef.current && estado === "idle") {
      autoStartedRef.current = true;
      toggleGrabacion();
    }
    return () => {
      if (estado === "grabando") detenerGrabacion();
    };
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <button
        onClick={toggleGrabacion}
        disabled={disabled || estado === "solicitando"}
        className={cn(
          "relative h-20 w-20 rounded-full flex items-center justify-center transition-all",
          estado === "grabando"
            ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
            : estado === "solicitando"
            ? "bg-amber-500 text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30"
        )}
      >
        {estado === "solicitando" ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : estado === "grabando" ? (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-red-300 animate-ping" />
            <div className="flex items-end gap-1 h-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1 bg-white rounded-full"
                  style={{
                    height: "100%",
                    animation: "wave 0.5s ease-in-out infinite",
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          </>
        ) : estado === "error" ? (
          <AlertCircle className="h-8 w-8" />
        ) : (
          <Mic className="h-8 w-8" />
        )}
      </button>
      <span className="text-xs text-muted-foreground">
        {estado === "grabando"
          ? "Grabando... click para detener"
          : estado === "solicitando"
          ? "Solicitando micrófono..."
          : estado === "error"
          ? error
          : "Click para iniciar"}
      </span>
    </div>
  );
}

function concatenarChunks(chunks: Float32Array[]): Float32Array {
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Float32Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function float32ToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
