import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { db } from "../models/database.pool";
import {
  crearAppTelnyx,
  firmarTelnyx,
  limpiarBaseTest,
  seedConfigBase,
  crearUsuario,
  capturarSSE,
} from "./helpers";

const app = crearAppTelnyx();

function payloadIncoming(to: string, callControlId: string, eventType = "call.initiated", direction = "incoming") {
  return {
    event_type: eventType,
    payload: {
      call_control_id: callControlId,
      call_session_id: "sess-1",
      from: "+529999999999",
      to,
      direction,
    },
  };
}

beforeAll(async () => {
  await limpiarBaseTest();
  await seedConfigBase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("POST /webhooks/telnyx/voice", () => {
  it("rechaza con 401 si la firma es inválida", async () => {
    const body = payloadIncoming("+521234567890", "cc-401");
    const res = await request(app)
      .post("/webhooks/telnyx/voice")
      .set("Content-Type", "application/json")
      .set("Telnyx-Signature-Ed25519", "1,base64invalida")
      .send(body);
    expect(res.status).toBe(401);
  });

  it("responde 200 OK a eventos no entrantes (outgoing)", async () => {
    const body = payloadIncoming("+521234567890", "cc-out", "call.initiated", "outgoing");
    const res = await request(app)
      .post("/webhooks/telnyx/voice")
      .set("Content-Type", "application/json")
      .set("Telnyx-Signature-Ed25519", firmarTelnyx(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.text).toBe("OK");
  });

  it("genera TeXML con <Stream> para una llamada entrante válida", async () => {
    const user = await crearUsuario({ saldo: 10, conTelefono: "+521234567890" });
    const body = payloadIncoming("+521234567890", "cc-ok-1");
    const res = await request(app)
      .post("/webhooks/telnyx/voice")
      .set("Content-Type", "application/json")
      .set("Telnyx-Signature-Ed25519", firmarTelnyx(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.text).toContain("<Stream");
    expect(res.text).toContain("stream/telnyx");

    // Registra la métrica de inicio
    const metric = await db.callMetric.findFirst({ where: { callSid: "cc-ok-1" } });
    expect(metric).toBeTruthy();
    expect(metric!.userId).toBe(user.id);
  });

  it("rechaza si el número no está registrado", async () => {
    const body = payloadIncoming("+529999000000", "cc-nophone");
    const res = await request(app)
      .post("/webhooks/telnyx/voice")
      .set("Content-Type", "application/json")
      .set("Telnyx-Signature-Ed25519", firmarTelnyx(body))
      .send(body);
    expect(res.text).toContain("no está configurado");
  });

  it("rechaza si el saldo está al límite negativo", async () => {
    await crearUsuario({ saldo: -5, conTelefono: "+521111111111" });
    const body = payloadIncoming("+521111111111", "cc-nosaldo");
    const res = await request(app)
      .post("/webhooks/telnyx/voice")
      .set("Content-Type", "application/json")
      .set("Telnyx-Signature-Ed25519", firmarTelnyx(body))
      .send(body);
    expect(res.text).toContain("no está disponible temporalmente");
  });

  it("rechaza si hay mensaje de mantenimiento global", async () => {
    await db.adminConfig.update({
      where: { clave: "mensaje_mantenimiento" },
      data: { valor: "Estamos en mantenimiento." },
    });
    try {
      await crearUsuario({ saldo: 10, conTelefono: "+521222222222" });
      const body = payloadIncoming("+521222222222", "cc-maint");
      const res = await request(app)
        .post("/webhooks/telnyx/voice")
        .set("Content-Type", "application/json")
        .set("Telnyx-Signature-Ed25519", firmarTelnyx(body))
        .send(body);
      expect(res.text).toContain("mantenimiento");
    } finally {
      await db.adminConfig.update({
        where: { clave: "mensaje_mantenimiento" },
        data: { valor: "" },
      });
    }
  });
});

describe("POST /webhooks/telnyx/call-control", () => {
  it("debita la wallet y actualiza la métrica al recibir call.hangup", async () => {
    const user = await crearUsuario({ saldo: 10, conTelefono: "+521333333333" });
    const sse = capturarSSE(user.id);
    try {
      // Llamada de 90s (registrada con inicio hace 90s)
      await db.callMetric.create({
        data: {
          callSid: "cc-hangup-1",
          userId: user.id,
          inicio: new Date(Date.now() - 90000),
        },
      });

      const body = { event_type: "call.hangup", payload: { call_control_id: "cc-hangup-1" } };
      const res = await request(app)
        .post("/webhooks/telnyx/call-control")
        .set("Content-Type", "application/json")
        .set("Telnyx-Signature-Ed25519", firmarTelnyx(body))
        .send(body);
      expect(res.status).toBe(200);

      // 90s -> ceil(90/60)=2 min -> 2 * 0.50 = 1.00
      const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
      expect(wallet?.saldo.toNumber()).toBeCloseTo(9, 4);

      const tx = await db.walletTransaction.findFirst({
        where: { userId: user.id, callSid: "cc-hangup-1" },
      });
      expect(tx?.tipo).toBe("debito");
      expect(tx?.monto.toNumber()).toBe(-1);

      const metric = await db.callMetric.findFirst({ where: { callSid: "cc-hangup-1" } });
      expect(metric?.duracionSegundos).toBeCloseTo(90, 0);
      expect(metric?.cobroAplicado?.toNumber()).toBe(1);
      expect(metric?.fin).toBeTruthy();

      // Emite SSE llamada_finalizada
      expect(sse.eventos()).toContain("llamada_finalizada");
    } finally {
      sse.liberar();
    }
  });

  it("no debita si no existe métrica de la llamada", async () => {
    const user = await crearUsuario({ saldo: 10, conTelefono: "+521444444444" });
    const body = { event_type: "call.hangup", payload: { call_control_id: "cc-hangup-null" } };
    const res = await request(app)
      .post("/webhooks/telnyx/call-control")
      .set("Content-Type", "application/json")
      .set("Telnyx-Signature-Ed25519", firmarTelnyx(body))
      .send(body);
    expect(res.status).toBe(200);
    const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
    expect(wallet?.saldo.toNumber()).toBe(10);
  });

  it("debita solo una vez si el hangup llega duplicado", async () => {
    const user = await crearUsuario({ saldo: 10, conTelefono: "+521666666666" });
    const sse = capturarSSE(user.id);
    try {
      await db.callMetric.create({
        data: {
          callSid: "cc-hangup-dup",
          userId: user.id,
          inicio: new Date(Date.now() - 90000),
        },
      });

      const body = { event_type: "call.hangup", payload: { call_control_id: "cc-hangup-dup" } };
      const header = firmarTelnyx(body);
      for (let i = 0; i < 2; i++) {
        const res = await request(app)
          .post("/webhooks/telnyx/call-control")
          .set("Content-Type", "application/json")
          .set("Telnyx-Signature-Ed25519", header)
          .send(body);
        expect(res.status).toBe(200);
      }

      const wallet = await db.wallet.findUnique({ where: { userId: user.id } });
      expect(wallet?.saldo.toNumber()).toBe(9); // debito único de 1.00

      const debitos = await db.walletTransaction.findMany({
        where: { userId: user.id, callSid: "cc-hangup-dup", tipo: "debito" },
      });
      expect(debitos).toHaveLength(1);

      expect(sse.eventos().filter((e) => e === "llamada_finalizada")).toHaveLength(1);
    } finally {
      sse.liberar();
    }
  });

  it("actualiza el inicio de la métrica con call.answered", async () => {
    const user = await crearUsuario({ saldo: 10, conTelefono: "+521555555555" });
    await db.callMetric.create({
      data: { callSid: "cc-answered-1", userId: user.id, inicio: new Date(Date.now() - 3600000) },
    });
    const body = { event_type: "call.answered", payload: { call_control_id: "cc-answered-1" } };
    const res = await request(app)
      .post("/webhooks/telnyx/call-control")
      .set("Content-Type", "application/json")
      .set("Telnyx-Signature-Ed25519", firmarTelnyx(body))
      .send(body);
    expect(res.status).toBe(200);

    const metric = await db.callMetric.findFirst({ where: { callSid: "cc-answered-1" } });
    const diffMs = Date.now() - metric!.inicio!.getTime();
    expect(diffMs).toBeLessThan(5000);
  });
});
