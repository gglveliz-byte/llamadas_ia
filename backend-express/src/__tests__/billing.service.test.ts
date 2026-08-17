import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../models/database.pool";
import {
  acreditarSaldo,
  debitarLlamada,
  verificarSaldo,
  reversarSaldo,
} from "../services/billing.service";
import { limpiarBaseTest, seedConfigBase, crearUsuario } from "./helpers";

beforeAll(async () => {
  await limpiarBaseTest();
  await seedConfigBase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("acreditarSaldo", () => {
  it("crea la wallet y la transacción de recarga en la primera recarga", async () => {
    const user = await crearUsuario({ businessSettings: false });
    const res = await acreditarSaldo(user.id, 1, "pay-001", 10);
    expect(res.saldoNuevo).toBe(10);

    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.saldo.toNumber()).toBe(10);

    const tx = await db.walletTransaction.findFirst({
      where: { userId: user.id, whopPaymentId: "pay-001" },
    });
    expect(tx?.tipo).toBe("recarga");
    expect(tx?.monto.toNumber()).toBe(10);
    expect(tx?.saldoNuevo.toNumber()).toBe(10);
  });

  it("acumula saldo en recargas posteriores (existe la wallet)", async () => {
    const user = await crearUsuario({ businessSettings: false });
    await acreditarSaldo(user.id, 2, "pay-010", 25); // Paquete Pro: saldoOtorgado 28
    const res = await acreditarSaldo(user.id, 3, "pay-011", 50); // Business: +60
    expect(res.saldoNuevo).toBe(28 + 60);

    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.saldo.toNumber()).toBe(88);
  });

  it("lanza error si el paquete no existe", async () => {
    const user = await crearUsuario({ businessSettings: false });
    await expect(acreditarSaldo(user.id, 9999, "pay-999", 10)).rejects.toThrow(
      "Paquete no encontrado"
    );
  });
});

describe("debitarLlamada", () => {
  it("cobra por minuto completo (ceil) cuando cobro_por_segundo=false", async () => {
    const user = await crearUsuario({ saldo: 10, businessSettings: false });
    // 61s -> ceil(61/60)=2 minutos -> 2 * 0.50 = 1.00
    const res = await debitarLlamada(user.id, "+1234567890", "call-min-1", 61);
    expect(res.monto).toBe(1);
    expect(res.saldoNuevo).toBe(9);

    const tx = await db.walletTransaction.findFirst({
      where: { userId: user.id, callSid: "call-min-1" },
    });
    expect(tx?.tipo).toBe("debito");
    expect(tx?.monto.toNumber()).toBe(-1);
  });

  it("cobra por segundo cuando cobro_por_segundo=true", async () => {
    await db.adminConfig.update({
      where: { clave: "cobro_por_segundo" },
      data: { valor: "true" },
    });
    try {
      const user = await crearUsuario({ saldo: 10, businessSettings: false });
      // 90s -> (0.50/60)*90 = 0.75
      const res = await debitarLlamada(user.id, "+1234567890", "call-sec-1", 90);
      expect(res.monto).toBeCloseTo(0.75, 4);
      expect(res.saldoNuevo).toBeCloseTo(9.25, 4);
    } finally {
      await db.adminConfig.update({
        where: { clave: "cobro_por_segundo" },
        data: { valor: "false" },
      });
    }
  });

  it("redondea el monto a 4 decimales", async () => {
    await db.adminConfig.update({
      where: { clave: "cobro_por_segundo" },
      data: { valor: "true" },
    });
    try {
      const user = await crearUsuario({ saldo: 10, businessSettings: false });
      // 1s -> 0.50/60 = 0.008333... -> redondeado a 0.0083
      const res = await debitarLlamada(user.id, "+1234567890", "call-round-1", 1);
      expect(res.monto).toBe(0.0083);
    } finally {
      await db.adminConfig.update({
        where: { clave: "cobro_por_segundo" },
        data: { valor: "false" },
      });
    }
  });

  it("usa el precio por minuto del paquete de la última recarga", async () => {
    const user = await crearUsuario({ saldo: 60, businessSettings: false });
    await acreditarSaldo(user.id, 3, "pay-price-1", 50); // Business: 0.30/min
    // 120s = 2 min -> 0.60
    const res = await debitarLlamada(user.id, "+1234567890", "call-price-1", 120);
    expect(res.monto).toBe(0.6);
  });
});

describe("verificarSaldo", () => {
  it("permite la llamada con saldo suficiente", async () => {
    const user = await crearUsuario({ saldo: 10, businessSettings: false });
    await expect(verificarSaldo(user.id)).resolves.toBe(true);
  });

  it("bloquea cuando el saldo llega al límite negativo", async () => {
    const user = await crearUsuario({ saldo: -5, businessSettings: false });
    await expect(verificarSaldo(user.id)).resolves.toBe(false);
  });

  it("bloquea cuando no existe wallet", async () => {
    await expect(verificarSaldo("00000000-0000-0000-0000-000000000000")).resolves.toBe(false);
  });
});

describe("Idempotencia (anti doble cobro)", () => {
  it("debitarLlamada con el mismo callSid no cobra dos veces", async () => {
    const user = await crearUsuario({ saldo: 10, businessSettings: false });
    const primera = await debitarLlamada(user.id, "+1234567890", "call-dup-1", 61); // 1.00
    const segunda = await debitarLlamada(user.id, "+1234567890", "call-dup-1", 61);

    expect(segunda.saldoNuevo).toBe(primera.saldoNuevo); // 9
    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.saldo.toNumber()).toBe(9);

    const debitos = await db.walletTransaction.findMany({
      where: { userId: user.id, callSid: "call-dup-1", tipo: "debito" },
    });
    expect(debitos).toHaveLength(1);
  });

  it("acreditarSaldo con el mismo whopPaymentId no acredita dos veces", async () => {
    const user = await crearUsuario({ businessSettings: false });
    const primera = await acreditarSaldo(user.id, 1, "pay-dup-1", 10);
    const segunda = await acreditarSaldo(user.id, 1, "pay-dup-1", 10);

    expect(segunda.saldoNuevo).toBe(primera.saldoNuevo); // 10
    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.saldo.toNumber()).toBe(10);

    const recargas = await db.walletTransaction.findMany({
      where: { userId: user.id, whopPaymentId: "pay-dup-1", tipo: "recarga" },
    });
    expect(recargas).toHaveLength(1);
  });

  it("reversarSaldo con el mismo whopPaymentId solo revierte una vez", async () => {
    const user = await crearUsuario({ businessSettings: false });
    await acreditarSaldo(user.id, 1, "pay-revdup-1", 10);
    await reversarSaldo("pay-revdup-1");
    await reversarSaldo("pay-revdup-1");

    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.saldo.toNumber()).toBe(0);

    const ajustes = await db.walletTransaction.findMany({
      where: { userId: user.id, whopPaymentId: "pay-revdup-1", tipo: "ajuste_admin" },
    });
    expect(ajustes).toHaveLength(1);
  });
});

describe("reversarSaldo", () => {
  it("revierte la recarga y registra ajuste_admin", async () => {
    const user = await crearUsuario({ businessSettings: false });
    await acreditarSaldo(user.id, 1, "pay-rev-1", 10);
    await reversarSaldo("pay-rev-1");

    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.saldo.toNumber()).toBe(0);

    const ajuste = await db.walletTransaction.findFirst({
      where: { userId: user.id, tipo: "ajuste_admin" },
    });
    expect(ajuste?.monto.toNumber()).toBe(-10);
  });

  it("no hace nada si el pago no existe", async () => {
    const user = await crearUsuario({ saldo: 5, businessSettings: false });
    await expect(reversarSaldo("pay-inexistente")).resolves.toBeUndefined();
    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.saldo.toNumber()).toBe(5);
  });
});
