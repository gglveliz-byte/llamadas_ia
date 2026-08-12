export interface VozGemini {
  id: string;
  label: string;
  descripcion: string;
}

export const VOCES_GEMINI: VozGemini[] = [
  { id: "Ursa", label: "Ursa", descripcion: "Intermedia, conversacional y cercana" },
  { id: "Vega", label: "Vega", descripcion: "Aguda, brillante, optimista y fresca" },
  { id: "Pegasus", label: "Pegasus", descripcion: "Profunda, grave y pausada" },
  { id: "Dipper", label: "Dipper", descripcion: "Profunda, firme y con cuerpo (serios)" },
  { id: "Eclipse", label: "Eclipse", descripcion: "Intermedia, muy enérgica y dinámica" },
  { id: "Capella", label: "Capella", descripcion: "Aguda, marcado acento británico nativo" },
  { id: "Orbit", label: "Orbit", descripcion: "Profunda, enérgica y con gran presencia" },
  { id: "Orion", label: "Orion", descripcion: "Profunda, clara y de oratoria brillante" },
  { id: "Flare", label: "Flare", descripcion: "Intermedia, suave y sutil" },
];

export const REGIONES_UI = [
  { code: "es-MX", label: "es-MX · México (latino)" },
  { code: "es-US", label: "es-US · Latino neutro (EE.UU.)" },
  { code: "es-ES", label: "es-ES · España" },
  { code: "es-AR", label: "es-AR · Argentina" },
  { code: "es-CO", label: "es-CO · Colombia" },
  { code: "en-US", label: "en-US · Estados Unidos" },
  { code: "en-GB", label: "en-GB · Reino Unido" },
  { code: "pt-BR", label: "pt-BR · Brasil" },
];
