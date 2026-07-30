"use client";

/**
 * Cliente API unificado para el frontend VozIA.
 * Enruta todas las llamadas a /api/* del propio Next.js.
 */

export class ApiClient {
  private static async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
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

// Tipos compartidos
export interface Usuario {
  id: string;
  email: string;
  role: "cliente" | "admin";
  businessName: string | null;
  businessPhone: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  twilioSubaccountSid: string | null;
}

export interface BusinessSettings {
  userId: string;
  aiLanguage: string;
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
    twilio: { concurrentCalls: number; maxConcurrent: number };
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
