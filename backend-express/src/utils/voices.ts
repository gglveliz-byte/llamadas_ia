/**
 * Voces reales de Gemini Live (modelos 3.x). Sustituyen a los nombres antiguos
 * (Puck, Charon, Fenrir, Kore, Aoede) que ya no son válidos en las previews.
 */
export interface VozGemini {
  id: string;
  label: string;
  descripcion: string;
}

export const VOCES_GEMINI: VozGemini[] = [
  { id: "Ursa", label: "Ursa", descripcion: "Tono intermedio, muy conversacional y cercano" },
  { id: "Vega", label: "Vega", descripcion: "Tono agudo, brillante, optimista y fresco" },
  { id: "Pegasus", label: "Pegasus", descripcion: "Tono profundo, grave y pausado" },
  { id: "Dipper", label: "Dipper", descripcion: "Tono profundo, firme y con cuerpo (perfiles serios)" },
  { id: "Eclipse", label: "Eclipse", descripcion: "Tono intermedio, muy enérgico y dinámico" },
  { id: "Capella", label: "Capella", descripcion: "Tono agudo, marcado acento británico nativo" },
  { id: "Orbit", label: "Orbit", descripcion: "Tono profundo, enérgico y con gran presencia" },
  { id: "Orion", label: "Orion", descripcion: "Tono profundo, claro y de oratoria brillante" },
  { id: "Flare", label: "Flare", descripcion: "Tono intermedio, suave y sutil" },
];

export const VOZ_DEFAULT = "Dipper";

const VOCES_VALIDAS = new Set(VOCES_GEMINI.map((v) => v.id));

/**
 * Devuelve siempre una voz válida: si el valor guardado no existe en la lista
 * actual de Gemini (p. ej. "Puck" de cuentas antiguas), cae en VOZ_DEFAULT.
 */
export function normalizarVoz(voz?: string | null): string {
  if (voz && VOCES_VALIDAS.has(voz)) return voz;
  return VOZ_DEFAULT;
}
