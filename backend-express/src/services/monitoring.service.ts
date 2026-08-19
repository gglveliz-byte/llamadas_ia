/**
 * Servicio de Monitoreo - Métricas CPU/RAM/latencia cada 10s.
 * Cumple spec sección 13.
 */
import os from "os";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";
import { enviarEmail, emailTemplates } from "./email.service";
import { emitirSSEAdmin } from "../sse/events.emitter";
import { actualizarRateLimitGemini, obtenerRateLimitGemini, actualizarRateLimitTelnyx, obtenerRateLimitTelnyx, obtenerConcurrenciaTelnyx } from "./ratelimit.service";
import { performance } from "perf_hooks";

// Monitor de latencia del Event Loop (detecta si el CPU se bloquea)
let lastLoopCheck = performance.now();
setInterval(() => {
  const now = performance.now();
  const lag = now - lastLoopCheck - 1000;
  // Umbral de 200ms: en servidores de 1 vCPU con ONNX inference,
  // lags de 50-100ms son normales y no ameritan alerta.
  if (lag > 200) {
    logger.warn({ lagMs: Math.round(lag) }, "⚠️ ALERTA: Event loop bloqueado (CPU saturado)");
  }
  lastLoopCheck = now;
}, 1000).unref();

interface Metrica {
  ts: number;
  cpu: number;
  ram: number;
  llamadas: number;
  latencia: number;
  heapMb: number;
  uptime: number;
}

const HISTORIAL_MAX = 360; // 60 minutos @ 10s
const historial: Metrica[] = [];
const latenciasRecientes: number[] = [];
let llamadasActivas = 0;
let intervalMonitor: NodeJS.Timeout | null = null;
let ultimoUmbralAlerta = 0; // Throttle: no más de 1 alerta cada 5 min

// Variables para medir CPU del proceso (process.cpuUsage)
let lastCpuUsage = process.cpuUsage();
let lastCpuCheckTime = process.hrtime.bigint();

export function incrementarLlamadasActivas(): void {
  llamadasActivas++;
}

export function decrementarLlamadasActivas(): void {
  llamadasActivas = Math.max(0, llamadasActivas - 1);
  if (llamadasActivas === 0) {
    latenciasRecientes.length = 0;
  }
}

export function registrarLatencia(ms: number): void {
  latenciasRecientes.push(ms);
  if (latenciasRecientes.length > 100) latenciasRecientes.shift();
}

export function obtenerMetricasActuales(): Metrica {
  const currentCpuUsage = process.cpuUsage();
  const currentCpuCheckTime = process.hrtime.bigint();
  
  const userDiff = currentCpuUsage.user - lastCpuUsage.user;
  const systemDiff = currentCpuUsage.system - lastCpuUsage.system;
  const timeDiffUs = Number(currentCpuCheckTime - lastCpuCheckTime) / 1000;

  // Porcentaje de CPU usado por este proceso de Node en el intervalo (puede usar múltiples cores)
  const cpuProcess = timeDiffUs > 0 ? ((userDiff + systemDiff) / timeDiffUs) * 100 : 0;
  
  lastCpuUsage = currentCpuUsage;
  lastCpuCheckTime = currentCpuCheckTime;

  const ram = (1 - os.freemem() / os.totalmem()) * 100;
  const heap = process.memoryUsage().heapUsed / 1024 / 1024;
  const latencia =
    latenciasRecientes.length > 0
      ? latenciasRecientes.reduce((s, l) => s + l, 0) / latenciasRecientes.length
      : 0;

  return {
    ts: Date.now(),
    cpu: Math.min(100, Math.max(0, cpuProcess)),
    ram,
    llamadas: llamadasActivas,
    latencia,
    heapMb: heap,
    uptime: process.uptime(),
  };
}

export function obtenerHistorial(): Metrica[] {
  return [...historial];
}

/**
 * Inicia el monitoreo cada 10 segundos.
 * Cumple spec 6.2 - verifica umbrales y envía alertas.
 */
export function iniciarMonitoreo(): void {
  if (intervalMonitor) return;

  intervalMonitor = setInterval(async () => {
    try {
      const metrica = obtenerMetricasActuales();
      historial.push(metrica);
      if (historial.length > HISTORIAL_MAX) historial.shift();

      // Verificar umbrales
      const umbrales = await obtenerUmbrales();
      const ahora = Date.now();
      const alertar =
        metrica.cpu > umbrales.cpu ||
        metrica.ram > umbrales.ram ||
        metrica.latencia > umbrales.latencia;

      if (alertar && ahora - ultimoUmbralAlerta > 5 * 60 * 1000) {
        ultimoUmbralAlerta = ahora;
        const mensaje = `⚠️ Alerta VozIA:
CPU: ${metrica.cpu.toFixed(1)}% (umbral ${umbrales.cpu}%)
RAM: ${metrica.ram.toFixed(1)}% (umbral ${umbrales.ram}%)
Latencia: ${metrica.latencia.toFixed(0)}ms (umbral ${umbrales.latencia}ms)
Llamadas activas: ${metrica.llamadas}
Heap: ${metrica.heapMb.toFixed(1)} MB
Uptime: ${Math.floor(metrica.uptime / 60)} min`;

        logger.warn({ metrica, umbrales }, "Umbral excedido - emitiendo alerta");

        // Emitir SSE a todos los admins conectados
        emitirSSEAdmin("alerta_sistema", { metrica, umbrales, mensaje });

        // Enviar email al admin (fire-and-forget: no bloquear el tick de 10s)
        enviarAlertaAdmin(mensaje).catch(() => {});
      }
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Error en tick de monitoreo");
    }
  }, 10000);

  logger.info("Monitoreo iniciado (intervalo 10s)");
}

export async function enviarAlertaAdmin(mensaje: string): Promise<void> {
  try {
    const emailAdmin = await db.adminConfig.findUnique({
      where: { clave: "email_admin_alertas" },
    });
    if (emailAdmin?.valor) {
      const template = emailTemplates.alertaSistema(mensaje);
      await enviarEmail({ to: emailAdmin.valor, ...template });
    }
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error enviando alerta admin");
  }
}

async function obtenerUmbrales(): Promise<{ cpu: number; ram: number; latencia: number }> {
  const [cpu, ram, lat] = await Promise.all([
    db.adminConfig.findUnique({ where: { clave: "alerta_cpu_porcentaje" } }),
    db.adminConfig.findUnique({ where: { clave: "alerta_ram_porcentaje" } }),
    db.adminConfig.findUnique({ where: { clave: "alerta_latencia_ms" } }),
  ]);
  return {
    cpu: parseFloat(cpu?.valor ?? "85"),
    ram: parseFloat(ram?.valor ?? "90"),
    latencia: parseInt(lat?.valor ?? "5000"),
  };
}

export function actualizarGeminiRateLimit(): void {
  // Ya no se usa mock - los headers se capturan automáticamente en gemini.handler.ts
  // Esta función se mantiene por compatibilidad pero ya no hace nada
}

export async function obtenerUltimoRateLimitGemini(): Promise<{ remaining: number; limit: number; resetAt: string }> {
  return obtenerRateLimitGemini();
}

export async function obtenerUltimoRateLimitTelnyx(): Promise<{ remaining: number; limit: number; resetAt: string }> {
  return obtenerRateLimitTelnyx();
}

export async function obtenerUltimaConcurrenciaTelnyx(): Promise<{ current: number; max: number }> {
  return obtenerConcurrenciaTelnyx();
}

export function detenerMonitoreo(): void {
  if (intervalMonitor) {
    clearInterval(intervalMonitor);
    intervalMonitor = null;
  }
}
