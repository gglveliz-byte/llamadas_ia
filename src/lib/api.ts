"use client";

import { useAppStore } from "./store";

export class ApiClient {
  private static getTokens(): { token: string | null; refreshToken: string | null } {
    if (typeof window === "undefined") return { token: null, refreshToken: null };
    const state = useAppStore.getState();
    return { token: state.token, refreshToken: state.refreshToken };
  }

  private static async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { token } = this.getTokens();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(path, {
      ...options,
      headers,
    });

    // No interceptar 401 si estamos intentando iniciar sesión
    const isLoginRoute = path.includes("/api/auth/login") || path.includes("/api/auth/affiliate-login");

    if (res.status === 401 && !isLoginRoute) {
      const { refreshToken } = this.getTokens();
      if (refreshToken) {
        try {
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            useAppStore.getState().setTokens(data.token, data.refreshToken);
            headers["Authorization"] = `Bearer ${data.token}`;
            const retryRes = await fetch(path, { ...options, headers });
            if (!retryRes.ok) {
              const errBody = await retryRes.json().catch(() => ({ error: retryRes.statusText }));
              throw new Error(errBody.error || `HTTP ${retryRes.status}`);
            }
            return retryRes.json() as Promise<T>;
          } else {
            useAppStore.getState().logout();
            throw new Error("Sesión expirada. Inicia sesión de nuevo.");
          }
        } catch {
          useAppStore.getState().logout();
          throw new Error("Sesión expirada. Inicia sesión de nuevo.");
        }
      } else {
        useAppStore.getState().logout();
        throw new Error("Sesión expirada. Inicia sesión de nuevo.");
      }
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  static get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  static post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export interface Usuario {
  id: string;
  email: string;
  role: "cliente" | "admin";
  businessName: string | null;
  businessPhone: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  telnyxChildAccountId: string | null;
  telnyxProvisioningStatus?: string;
  telnyxProvisioningError?: string | null;
  slug?: string;
  nombre?: string;
  comisionPorMinuto?: number;
  installationPaid?: boolean;
  installationAmount?: number;
}

export interface BusinessSettings {
  userId: string;
  aiLanguage: string;
  aiVoice: string;
  aiRegion: string;
  mensajeSaludo: string | null;
  bookingMode: "hours" | "nights";
  defaultDurationMinutes: number;
  checkInTime: string;
  checkOutTime: string;
  businessHours: Record<string, { abierto: boolean; inicio: string | null; fin: string | null }>;
  modo247: boolean;
  timezone: string;
  grabacionActiva: boolean;
  mensajeConsentimiento: string;
  consentimientoActivo: boolean;
  formFields: Array<{ key: string; label: string; type: string; required: boolean }>;
  systemPromptContext: string;
  recursos: Array<{ id: string; nombre: string }>;
  precioPorMinuto?: number;
  depositoMinimo?: number;
  registrationSlug?: string;
  landingColorPrimario?: string;
  landingDescripcion?: string;
  updatedAt: string;
}

export interface Wallet {
  userId: string;
  saldo: number;
  moneda: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  tipo: "recarga" | "debito" | "ajuste_admin" | "trial";
  monto: number;
  saldoAnterior: number;
  saldoNuevo: number;
  whopPaymentId: string | null;
  callSid: string | null;
  descripcion: string | null;
  createdAt: string;
}

export interface RechargePackage {
  id: number;
  nombre: string;
  montoRecarga: number;
  saldoOtorgado: number;
  precioPorMinuto: number;
  precioPorSegundo: number | null;
  activo: boolean;
  createdAt: string;
}

export interface Appointment {
  id: string;
  userId: string;
  phoneNumberId: number | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  extraFields: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  recursoId: string | null;
  servicio: string | null;
  status: "agendado" | "asistio" | "no_asistio" | "cancelado";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  phoneNumber?: { phoneNumber: string } | null;
}

export interface Notification {
  id: number;
  userId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}

export interface ClienteAdmin {
  id: string;
  email: string;
  businessName: string;
  isSuspended: boolean;
  isVerified: boolean;
  createdAt: string;
  saldo: number;
  totalDebitado: number;
  totalRecargado: number;
  minutosLlamada: number;
  totalLlamadas: number;
  totalCitas: number;
  totalNumeros: number;
  aiLanguage: string;
  timezone: string;
}

export interface MetricasAdmin {
  actual: {
    cpu: number;
    ram: number;
    latencia: number;
    llamadas: number;
    llamadasActivas: number;
    heap?: number;
    heapMb?: number;
    uptime: number;
    ts: string;
    clientesSSE?: number;
  };
  historial: Array<{
    ts: string;
    cpu: number;
    ram: number;
    latencia: number;
    llamadas: number;
  }>;
  aggregate: {
    totalClientes: number;
    clientesSuspendidos: number;
    llamadasHoy: number;
    minutosHoy: number;
    ingresosHoy: number;
    recargasHoy: number;
    latenciaPromedio: number;
    erroresRecientes: number;
  };
  rateLimits: {
    gemini: { remaining: number; limit: number; resetAt: string };
    telnyx: { concurrentCalls: number; maxConcurrent: number };
    whop: { lastWebhook: string; status: string };
  };
  umbrales: { cpu: number; ram: number; latencia: number };
  alertas: Array<{ tipo: string; mensaje: string }>;
  fuente?: string;
}

export interface Cashflow {
  totalRecargas: number;
  totalDebitos: number;
  balance: number;
  totalTransacciones: number;
  serie: Array<{ dia: string; recargas: number; debitos: number; balance: number }>;
  transacciones: Array<WalletTransaction & { user?: { businessName: string; email: string } }>;
}
