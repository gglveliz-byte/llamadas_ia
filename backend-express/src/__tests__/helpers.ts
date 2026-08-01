import crypto from "crypto";
import express from "express";
import { db } from "../models/database.pool";
import { telnyxRouter } from "../routes/webhooks.telnyx";
import { registrarClienteSSE, removerClienteSSE } from "../sse/events.emitter";

// ─── Firma Telnyx (Ed25519) ───
export function firmarTelnyx(body: unknown, timestamp?: string): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000).toString();
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const privatePem = (globalThis as any).__TELNYX_TEST_PRIVATE_KEY__ as string;
  const sig = crypto.sign(null, Buffer.from(`${ts}|${bodyStr}`, "utf8"), privatePem);
  return `${ts},${sig.toString("base64")}`;
}

export function crearAppTelnyx(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/webhooks/telnyx", telnyxRouter);
  return app;
}

// ─── Base de test ───
export async function limpiarBaseTest(): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "test"."wallet_transactions", "test"."notifications", "test"."call_metrics", "test"."call_transcripts", "test"."call_recordings", "test"."appointments", "test"."phone_numbers", "test"."business_settings", "test"."wallet", "test"."users", "test"."audit_logs", "test"."admin_config", "test"."recharge_packages" CASCADE;`
  );
}

export async function seedConfigBase(): Promise<void> {
  const configs = [
    { clave: "limite_saldo_negativo", valor: "-5.00" },
    { clave: "cobro_por_segundo", valor: "false" },
    { clave: "precio_minuto_default", valor: "0.50" },
    { clave: "mensaje_mantenimiento", valor: "" },
  ];
  for (const c of configs) {
    await db.adminConfig.upsert({
      where: { clave: c.clave },
      update: { valor: c.valor },
      create: { clave: c.clave, valor: c.valor },
    });
  }
  const packages = [
    { nombre: "Paquete Básico", montoRecarga: 10, saldoOtorgado: 10, precioPorMinuto: 0.5 },
    { nombre: "Paquete Pro", montoRecarga: 25, saldoOtorgado: 28, precioPorMinuto: 0.4 },
    { nombre: "Paquete Business", montoRecarga: 50, saldoOtorgado: 60, precioPorMinuto: 0.3 },
    { nombre: "Paquete Ilimitado", montoRecarga: 100, saldoOtorgado: 130, precioPorMinuto: 0.25 },
  ];
  for (let i = 0; i < packages.length; i++) {
    await db.rechargePackage.upsert({
      where: { id: i + 1 },
      update: packages[i],
      create: { id: i + 1, ...packages[i] },
    });
  }
}

let contador = 0;
export async function crearUsuario(params: {
  email?: string;
  saldo?: number;
  conTelefono?: string;
  businessSettings?: boolean;
  conRecarga?: boolean;
} = {}): Promise<{ id: string; email: string }> {
  contador++;
  const email = params.email ?? `test-${Date.now()}-${contador}@test.com`;
  const user = await db.user.create({
    data: {
      email,
      passwordHash: "hash-test",
      isVerified: true,
      businessName: "Test Negocio",
    },
  });

  if (params.businessSettings !== false) {
    const horario24h = {
      lunes: { abierto: true, inicio: "00:00", fin: "23:59" },
      martes: { abierto: true, inicio: "00:00", fin: "23:59" },
      miercoles: { abierto: true, inicio: "00:00", fin: "23:59" },
      jueves: { abierto: true, inicio: "00:00", fin: "23:59" },
      viernes: { abierto: true, inicio: "00:00", fin: "23:59" },
      sabado: { abierto: true, inicio: "00:00", fin: "23:59" },
      domingo: { abierto: true, inicio: "00:00", fin: "23:59" },
    };
    await db.businessSettings.create({
      data: {
        userId: user.id,
        aiLanguage: "es",
        modo247: true,
        businessHours: horario24h,
      },
    });
  }

  await db.wallet.create({
    data: { userId: user.id, saldo: params.saldo ?? 0 },
  });

  if (params.conTelefono) {
    await db.phoneNumber.create({
      data: { userId: user.id, phoneNumber: params.conTelefono },
    });
  }

  if (params.conRecarga) {
    await db.walletTransaction.create({
      data: {
        userId: user.id,
        tipo: "recarga",
        monto: params.saldo ?? 0,
        saldoAnterior: 0,
        saldoNuevo: params.saldo ?? 0,
        descripcion: "Recarga Paquete Básico ($10)",
      },
    });
  }

  return { id: user.id, email };
}

// ─── Captura SSE ───
export function capturarSSE(userId: string) {
  const escritos: string[] = [];
  const cliente = registrarClienteSSE(userId, {
    write: (chunk: string) => {
      escritos.push(chunk);
      return true;
    },
  } as any);
  return {
    escritos,
    liberar: () => removerClienteSSE(cliente),
    eventos: () =>
      escritos
        .filter((e) => e.startsWith("event: "))
        .map((e) => e.split("\n")[0].replace("event: ", "")),
  };
}

// ─── Sesión Gemini fake ───
export function crearSesionFalsa(mensajes: any[]) {
  let i = 0;
  const enviados: any[] = [];
  const sesion = {
    [Symbol.asyncIterator]() {
      return {
        next: async (): Promise<IteratorResult<any>> => {
          if (i < mensajes.length) return { done: false, value: mensajes[i++] };
          return { done: true, value: undefined };
        },
      };
    },
    sendRealtimeInput: async (payload: any) => {
      enviados.push(payload);
    },
  };
  return { sesion, enviados };
}
