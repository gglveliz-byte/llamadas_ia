import { describe, it, expect, vi } from "vitest";
import { conTimeout, firmaHerramienta, crearDedup } from "../utils/toolGuards";

describe("conTimeout", () => {
  it("resuelve si la promesa termina antes del timeout", async () => {
    const res = await conTimeout(Promise.resolve("ok"), 500);
    expect(res).toBe("ok");
  });

  it("rechaza si la promesa excede el timeout", async () => {
    await expect(
      conTimeout(new Promise((r) => setTimeout(() => r("tarde"), 100)), 20)
    ).rejects.toThrow(/Timeout/);
  });

  it("rechaza con el error original si la promesa falla antes del timeout", async () => {
    await expect(
      conTimeout(Promise.reject(new Error("falla real")), 500)
    ).rejects.toThrow("falla real");
  });
});

describe("firmaHerramienta", () => {
  it("es estable ante el orden de las claves", () => {
    const a = firmaHerramienta("agendar_cita", { a: 1, b: 2 });
    const b = firmaHerramienta("agendar_cita", { b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("distingue herramientas y args distintos", () => {
    expect(firmaHerramienta("x", { a: 1 })).not.toBe(firmaHerramienta("y", { a: 1 }));
    expect(firmaHerramienta("x", { a: 1 })).not.toBe(firmaHerramienta("x", { a: 2 }));
  });
});

describe("crearDedup", () => {
  it("detecta una firma recién marcada", () => {
    const d = crearDedup(1000);
    d.marcar("clave");
    expect(d.yaEjecutada("clave")).toBe(true);
    expect(d.yaEjecutada("otra")).toBe(false);
  });

  it("deja de detectar después del TTL", async () => {
    const d = crearDedup(30);
    d.marcar("clave");
    await new Promise((r) => setTimeout(r, 60));
    expect(d.yaEjecutada("clave")).toBe(false);
  });

  it("permite que un nuevo callSid ejecute la misma herramienta", () => {
    const d = crearDedup();
    d.marcar("callA|agendar_cita");
    expect(d.yaEjecutada("callB|agendar_cita")).toBe(false);
  });

  it("no se rompe al superar el tope de limpieza", () => {
    const d = crearDedup(1);
    for (let i = 0; i < 250; i++) d.marcar(`k${i}`);
    expect(d.yaEjecutada("nueva")).toBe(false);
    expect(d.yaEjecutada("k0")).toBe(false);
  });
});
