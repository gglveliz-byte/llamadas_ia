import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../models/database.pool";
import { procesarMensajesGemini, ejecutarHerramienta } from "../websockets/gemini.handler";
import {
  limpiarBaseTest,
  seedConfigBase,
  crearUsuario,
  capturarSSE,
  crearSesionFalsa,
} from "./helpers";

beforeAll(async () => {
  await limpiarBaseTest();
  await seedConfigBase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("procesarMensajesGemini", () => {
  it("emite transcripción SSE por cada parte de texto", async () => {
    const user = await crearUsuario();
    const sse = capturarSSE(user.id);
    try {
      const { sesion } = crearSesionFalsa([
        {
          serverContent: {
            modelTurn: { parts: [{ text: "Hola, ¿en qué puedo ayudarte?" }] },
          },
        },
        { serverContent: { turnComplete: true } },
      ]);
      const enviarATelnyx = () => {};

      await procesarMensajesGemini(sesion, user.id, "call-gem-1", "stream-1", enviarATelnyx);

      expect(sse.eventos()).toContain("transcripcion");
      const escrito = sse.escritos.find((e) => e.startsWith("event: transcripcion"));
      expect(escrito).toBeTruthy();
      expect(JSON.parse(escrito!.split("\ndata: ")[1])).toMatchObject({
        callSid: "call-gem-1",
        rol: "ai",
        texto: "Hola, ¿en qué puedo ayudarte?",
      });
    } finally {
      sse.liberar();
    }
  });

  it("responde a function calls con sendRealtimeInput", async () => {
    const user = await crearUsuario();
    try {
      const { sesion, enviados } = crearSesionFalsa([
        {
          serverContent: {
            modelTurn: {
              parts: [
                {
                  functionCall: {
                    name: "consultar_disponibilidad",
                    args: { date: "2026-08-10" },
                  },
                },
              ],
            },
          },
        },
        { serverContent: { turnComplete: true } },
      ]);
      const enviarATelnyx = () => {};

      await procesarMensajesGemini(sesion, user.id, "call-gem-2", "stream-2", enviarATelnyx);

      expect(enviados).toHaveLength(1);
      const response = enviados[0].functionResponses[0];
      expect(response.name).toBe("consultar_disponibilidad");
      expect(Array.isArray(response.response.disponibles)).toBe(true);
    } finally {
      await db.appointment.deleteMany({ where: { userId: user.id } });
      await db.businessSettings.deleteMany({ where: { userId: user.id } });
      await db.wallet.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it("no envía audio si la parte no tiene audio", async () => {
    const user = await crearUsuario();
    const sse = capturarSSE(user.id);
    try {
      const { sesion, enviados } = crearSesionFalsa([
        {
          serverContent: {
            modelTurn: { parts: [{ text: "Solo texto, sin audio." }] },
          },
        },
      ]);
      const enviarATelnyx = () => {};
      await procesarMensajesGemini(sesion, user.id, "call-gem-3", "stream-3", enviarATelnyx);
      expect(enviados).toHaveLength(0);
      expect(sse.eventos()).toContain("transcripcion");
    } finally {
      sse.liberar();
    }
  });

  it("persiste transcripts en callTranscript vía onTranscripcion", async () => {
    const user = await crearUsuario();
    try {
      const { sesion } = crearSesionFalsa([
        {
          serverContent: {
            modelTurn: {
              parts: [{ text: "Hola, bienvenido" }, { text: "¿Qué necesitas?" }],
            },
          },
        },
      ]);
      const acumulado: Array<{ texto: string; rol: string; ts: number }> = [];
      await procesarMensajesGemini(
        sesion,
        user.id,
        "call-transcript-1",
        "stream-transcript-1",
        () => {},
        (texto, rol, ts) => acumulado.push({ texto, rol, ts })
      );

      expect(acumulado).toHaveLength(2);
      expect(acumulado.map((a) => a.rol)).toEqual(["ai", "ai"]);

      await db.callTranscript.createMany({
        data: acumulado.map((t) => ({
          callSid: "call-transcript-1",
          userId: user.id,
          rol: t.rol,
          texto: t.texto,
          ts: new Date(t.ts),
        })),
      });

      const guardados = await db.callTranscript.findMany({
        where: { userId: user.id },
        orderBy: { id: "asc" },
      });
      expect(guardados).toHaveLength(2);
      expect(guardados[0].texto).toBe("Hola, bienvenido");
    } finally {
      await db.callTranscript.deleteMany({ where: { userId: user.id } });
      await db.businessSettings.deleteMany({ where: { userId: user.id } });
      await db.wallet.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
  });
});

describe("ejecutarHerramienta", () => {
  it("devuelve error para herramienta desconocida", async () => {
    const res = await ejecutarHerramienta("herramienta_fantasma", {}, "u", "call-herramienta-1");
    expect(res).toEqual({ error: "Herramienta herramienta_fantasma no implementada" });
  });
});
