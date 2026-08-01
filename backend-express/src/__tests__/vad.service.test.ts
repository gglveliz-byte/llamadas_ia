import { describe, it, expect } from "vitest";
import {
  crearDetectorVoz,
  tieneVozPorEnergia,
  verificarVad,
} from "../services/vad.service";

function generarSilencio(ms: number, sampleRate = 8000): Buffer {
  const numSamples = Math.floor((sampleRate * ms) / 1000);
  return Buffer.alloc(numSamples * 2);
}

function generarTonoFuerte(ms: number, sampleRate = 8000, freq = 440): Buffer {
  const numSamples = Math.floor((sampleRate * ms) / 1000);
  const buf = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 10000), i * 2);
  }
  return buf;
}

describe("vad.service", () => {
  it("tieneVozPorEnergia: silencio devuelve false", () => {
    expect(tieneVozPorEnergia(generarSilencio(100))).toBe(false);
  });

  it("tieneVozPorEnergia: señal fuerte devuelve true", () => {
    expect(tieneVozPorEnergia(generarTonoFuerte(100))).toBe(true);
  });

  it("crearDetectorVoz: devuelve detector funcional sin lanzar", async () => {
    const detector = await crearDetectorVoz(8000, 1);
    expect(typeof detector.tieneVoz).toBe("function");
    expect(typeof detector.liberar).toBe("function");
    expect(detector.tieneVoz(generarSilencio(100))).toBe(false);
    detector.liberar();
  });

  it("verificarVad: no lanza (carga wasm o cae a fallback)", async () => {
    const result = await verificarVad();
    expect(typeof result).toBe("boolean");
  });
});
