/**
 * Configuración regional de la voz: language_code de Gemini Live + la
 * "mentalidad cultural" que se inyecta en el system prompt para que el acento
 * y la jerga sean creíbles (no solo la tonada del language_code).
 *
 * Jerarquía: PAÍS → IDIOMA(S) → ACENTO(S).
 * - El idioma principal de cada país usa el acento regional propio (es-MX, es-AR, en-GB…).
 * - Los idiomas secundarios oficiales usan acentos NEUTROS (es-419, en-US, fr-FR…).
 * - El acento se persiste en settings.aiRegion con id "PAIS-idioma" (ej. "MX-es").
 * - El idioma (es/en/pt…) SIEMPRE se deriva del acento (nunca se configura libre).
 *
 * Nota: src/lib/paises.ts (frontend) es el espejo de este dataset. Mantener en sync.
 */

export interface AcentoGemini {
  /** id persistido en settings.aiRegion (ej. "MX-es", "US-en") */
  id: string;
  /** nombre para mostrar en la UI (ej. "Mexicano") */
  nombre: string;
  /** language_code BCP-47 enviado a Gemini Live */
  languageCode: string;
  /** mentalidad cultural inyectada en el system prompt */
  snippet: string;
}

export interface IdiomaPais {
  /** código de idioma derivado (es, en, pt…) */
  idioma: string;
  idiomaNombre: string;
  /** true si es idioma secundario del país (acento neutro) */
  idiomaNeutro: boolean;
  acentos: AcentoGemini[];
}

export interface PaisConfig {
  codigo: string;
  nombre: string;
  bandera: string;
  idiomas: IdiomaPais[];
}

export interface RegionGemini {
  languageCode: string;
  snippet: string;
}

/**
 * Acento neutro base: se usa en idiomas secundarios y en países sin una
 * "mentalidad regional" propia. Aplica a cualquier idioma de destino.
 */
const NEUTRO =
  "Acento neutro y profesional: habla con claridad y cercanía, sin regionalismos marcados ni jerga local. Solo cuida la tonada natural del idioma.";

export const PAISES: PaisConfig[] = [
  {
    codigo: "US",
    nombre: "Estados Unidos",
    bandera: "🇺🇸",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "US-en",
            nombre: "Estadounidense",
            languageCode: "en-US",
            snippet:
              "American professional mindset. Be direct and friendly; natural transitions like 'so', 'look', 'all right', 'got it'.",
          },
        ],
      },
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: true,
        acentos: [
          {
            id: "US-es",
            nombre: "Español (neutro EE.UU.)",
            languageCode: "es-US",
            snippet:
              "Español latino neutro (Estados Unidos). Habla claro, cercano y sin regionalismos marcados; usa transiciones naturales como 'a ver', 'claro', 'mira'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "CA",
    nombre: "Canadá",
    bandera: "🇨🇦",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CA-en",
            nombre: "Canadiense",
            languageCode: "en-CA",
            snippet:
              "Canadian professional mindset. Friendly and polite, with the neutral North-American tone; natural transitions like 'right', 'so', 'actually'.",
          },
        ],
      },
      {
        idioma: "fr",
        idiomaNombre: "Francés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CA-fr",
            nombre: "Francés canadiense",
            languageCode: "fr-CA",
            snippet:
              "Mentalité québécoise proche et chaleureuse. Parle avec un ton cordial; transitions naturelles comme 'ben', 'tu sais', 'd'accord', 'voyons' (avec mesure).",
          },
        ],
      },
    ],
  },
  {
    codigo: "MX",
    nombre: "México",
    bandera: "🇲🇽",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "MX-es",
            nombre: "Mexicano",
            languageCode: "es-MX",
            snippet:
              "Mentalidad mexicana elegante. Para sonar humano usa analogías locales del ámbito profesional como 'ir al grano', 'no nos hagamos bolas', 'poner las cartas sobre la mesa'. Evita jerga callejera ordinaria ('güey', 'chido'); usa transiciones naturales como 'órale', 'a ver', 'fíjate que…', 'está bien'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "GT",
    nombre: "Guatemala",
    bandera: "🇬🇹",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "GT-es",
            nombre: "Guatemalteco",
            languageCode: "es-GT",
            snippet:
              "Mentalidad guatemalteca cordial y formal. Trato respetuoso de 'usted'; transiciones naturales como 'mirá vos', 'claro', 'fijate que', 'perfecto'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "HN",
    nombre: "Honduras",
    bandera: "🇭🇳",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "HN-es",
            nombre: "Hondureño",
            languageCode: "es-HN",
            snippet:
              "Mentalidad hondureña cercana y tranquila. Transiciones naturales como 'mirá', 'a ver', 'listo', 'dale'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "SV",
    nombre: "El Salvador",
    bandera: "🇸🇻",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "SV-es",
            nombre: "Salvadoreño",
            languageCode: "es-SV",
            snippet:
              "Mentalidad salvadoreña amable y directa. Transiciones naturales como 'mirá', 'claro', 'vos sabés', 'dale'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "NI",
    nombre: "Nicaragua",
    bandera: "🇳🇮",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "NI-es",
            nombre: "Nicaragüense",
            languageCode: "es-NI",
            snippet:
              "Mentalidad nicaragüense cálida y pausada. Transiciones naturales como 'mire', 'a ver', 'claro que sí'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "CR",
    nombre: "Costa Rica",
    bandera: "🇨🇷",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CR-es",
            nombre: "Costarricense",
            languageCode: "es-CR",
            snippet:
              "Mentalidad costarricense amable y relajada. Trato de 'usted' y 'mae' solo con mucha cercanía; transiciones naturales como 'pura vida', 'listo', 'diay', 'claro'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "PA",
    nombre: "Panamá",
    bandera: "🇵🇦",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "PA-es",
            nombre: "Panameño",
            languageCode: "es-PA",
            snippet:
              "Mentalidad panameña cordial y eficiente. Transiciones naturales como 'mira', 'claro', 'listo', 'qué bien'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "CU",
    nombre: "Cuba",
    bandera: "🇨🇺",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CU-es",
            nombre: "Cubano",
            languageCode: "es-CU",
            snippet:
              "Mentalidad cubana expresiva y cálida. Transiciones naturales como 'mira', 'óyeme', 'claro', 'ya tú sabes' (con sutileza profesional).",
          },
        ],
      },
    ],
  },
  {
    codigo: "DO",
    nombre: "República Dominicana",
    bandera: "🇩🇴",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "DO-es",
            nombre: "Dominicano",
            languageCode: "es-DO",
            snippet:
              "Mentalidad dominicana cercana y vivaz. Transiciones naturales como 'mira', 'claro', 'tranquilo', 'qué bueno'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "PR",
    nombre: "Puerto Rico",
    bandera: "🇵🇷",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "PR-es",
            nombre: "Puertorriqueño",
            languageCode: "es-PR",
            snippet:
              "Mentalidad puertorriqueña cálida y expresiva. Transiciones naturales como 'mira', 'claro', 'tranquilo', 'ya tú sabes'.",
          },
        ],
      },
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: true,
        acentos: [
          {
            id: "PR-en",
            nombre: "Inglés (neutro)",
            languageCode: "en-US",
            snippet:
              "Neutral professional English: clear and friendly, without strong regionalisms.",
          },
        ],
      },
    ],
  },
  {
    codigo: "CO",
    nombre: "Colombia",
    bandera: "🇨🇴",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CO-es",
            nombre: "Colombiano",
            languageCode: "es-CO",
            snippet:
              "Mentalidad colombiana cercana. Trato cordial de 'tú'/'usted' según el momento. Transiciones naturales como 'pues', 'mire', 'listo', '¿cierto?', 'tranquilo'. Sin exceso de jerga callejera.",
          },
        ],
      },
    ],
  },
  {
    codigo: "VE",
    nombre: "Venezuela",
    bandera: "🇻🇪",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "VE-es",
            nombre: "Venezolano",
            languageCode: "es-VE",
            snippet:
              "Mentalidad venezolana cálida y expresiva. Transiciones naturales como 'pues', 'mira', 'listo', '¿me entiendes?', 'claro'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "EC",
    nombre: "Ecuador",
    bandera: "🇪🇨",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "EC-es",
            nombre: "Ecuatoriano",
            languageCode: "es-EC",
            snippet:
              "Mentalidad ecuatoriana amable y formal. Trato de 'usted'; transiciones naturales como 'mire', 'claro', 'listo'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "PE",
    nombre: "Perú",
    bandera: "🇵🇪",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "PE-es",
            nombre: "Peruano",
            languageCode: "es-PE",
            snippet:
              "Mentalidad peruana cordial y profesional. Trato de 'usted'/'tú' según el contexto; transiciones naturales como 'mire', 'claro', 'listo', '¿ya?', 'perfecto'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "BO",
    nombre: "Bolivia",
    bandera: "🇧🇴",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "BO-es",
            nombre: "Boliviano",
            languageCode: "es-BO",
            snippet:
              "Mentalidad boliviana respetuosa y tranquila. Trato de 'usted'; transiciones naturales como 'mire', 'claro', 'listo'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "CL",
    nombre: "Chile",
    bandera: "🇨🇱",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CL-es",
            nombre: "Chileno",
            languageCode: "es-CL",
            snippet:
              "Mentalidad chilena directa y cercana. Transiciones naturales como 'ya', 'claro', 'perfecto', 'dale', 'mira'. Modera el weon/muletillas callejeras.",
          },
        ],
      },
    ],
  },
  {
    codigo: "AR",
    nombre: "Argentina",
    bandera: "🇦🇷",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "AR-es",
            nombre: "Argentino (rioplatense)",
            languageCode: "es-AR",
            snippet:
              "Mentalidad argentina porteña educada. Usa el voseo de forma nativa ('vos sabés', 'tenés', 'decime'). Analogías locales y sofisticadas ('no des vueltas', 'poner los patitos en fila', 'vender humo'). Transiciones como 'che', 'mirá', 'bueno', 'viste', 'dale'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "UY",
    nombre: "Uruguay",
    bandera: "🇺🇾",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "UY-es",
            nombre: "Uruguayo",
            languageCode: "es-UY",
            snippet:
              "Mentalidad uruguaya cercana con voseo ('vos sabés', 'tenés'). Transiciones naturales como 'bueno', 'mirá', 'claro', 'dale', 'ta' (con sutileza).",
          },
        ],
      },
    ],
  },
  {
    codigo: "PY",
    nombre: "Paraguay",
    bandera: "🇵🇾",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "PY-es",
            nombre: "Paraguayo",
            languageCode: "es-PY",
            snippet:
              "Mentalidad paraguaya cordial y respetuosa. Trato de 'usted'; transiciones naturales como 'mire', 'claro', 'listo'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "ES",
    nombre: "España",
    bandera: "🇪🇸",
    idiomas: [
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: false,
        acentos: [
          {
            id: "ES-es",
            nombre: "Español (España)",
            languageCode: "es-ES",
            snippet:
              "Mentalidad española. Trato de 'tú' directo y asertivo. Analogías como 'ir al grano', 'no te enrolles', 'poner los puntos sobre las íes'. Transiciones como 'venga', 'vale', 'a ver', 'es una pasada' (con sutileza).",
          },
        ],
      },
    ],
  },
  {
    codigo: "GB",
    nombre: "Reino Unido",
    bandera: "🇬🇧",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "GB-en",
            nombre: "Británico",
            languageCode: "en-GB",
            snippet:
              "British polished mindset. Keep a refined tone; natural transitions like 'right', 'alright', 'let me see'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "IE",
    nombre: "Irlanda",
    bandera: "🇮🇪",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "IE-en",
            nombre: "Irlandés",
            languageCode: "en-IE",
            snippet:
              "Irish warm and friendly mindset. Natural transitions like 'right', 'sure', 'let me see', 'grand'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "PT",
    nombre: "Portugal",
    bandera: "🇵🇹",
    idiomas: [
      {
        idioma: "pt",
        idiomaNombre: "Portugués",
        idiomaNeutro: false,
        acentos: [
          {
            id: "PT-pt",
            nombre: "Portugués europeo",
            languageCode: "pt-PT",
            snippet:
              "Mentalidade portuguesa educada e formal. Transições naturais como 'então', 'olhe', 'certo', 'vamos ver', 'está bem'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "BR",
    nombre: "Brasil",
    bandera: "🇧🇷",
    idiomas: [
      {
        idioma: "pt",
        idiomaNombre: "Portugués",
        idiomaNeutro: false,
        acentos: [
          {
            id: "BR-pt",
            nombre: "Brasileño",
            languageCode: "pt-BR",
            snippet:
              "Mentalidade brasileira simpática e direta. Transições naturais como 'então', 'olha', 'certo', 'vamos ver'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "FR",
    nombre: "Francia",
    bandera: "🇫🇷",
    idiomas: [
      {
        idioma: "fr",
        idiomaNombre: "Francés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "FR-fr",
            nombre: "Francés (Francia)",
            languageCode: "fr-FR",
            snippet:
              "Mentalité française directe et professionnelle. Transitions naturelles comme 'alors', 'voilà', 'bon', 'd'accord'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "BE",
    nombre: "Bélgica",
    bandera: "🇧🇪",
    idiomas: [
      {
        idioma: "nl",
        idiomaNombre: "Neerlandés",
        idiomaNeutro: false,
        acentos: [
          { id: "BE-nl", nombre: "Flamenco", languageCode: "nl-BE", snippet: NEUTRO },
        ],
      },
      {
        idioma: "fr",
        idiomaNombre: "Francés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "BE-fr",
            nombre: "Francés belga",
            languageCode: "fr-BE",
            snippet:
              "Mentalité belge chaleureuse et posée. Transitions naturelles comme 'alors', 'voilà', 'ça va', 'd'accord'.",
          },
        ],
      },
      {
        idioma: "de",
        idiomaNombre: "Alemán",
        idiomaNeutro: true,
        acentos: [
          { id: "BE-de", nombre: "Alemán (neutro)", languageCode: "de-DE", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "CH",
    nombre: "Suiza",
    bandera: "🇨🇭",
    idiomas: [
      {
        idioma: "de",
        idiomaNombre: "Alemán",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CH-de",
            nombre: "Suizo alemán",
            languageCode: "de-CH",
            snippet:
              "Schweizer Mentalität: ruhig, präzise und freundlich. Natürliche Übergänge wie 'also', 'gut', 'alles klar'.",
          },
        ],
      },
      {
        idioma: "fr",
        idiomaNombre: "Francés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CH-fr",
            nombre: "Suizo francés",
            languageCode: "fr-CH",
            snippet:
              "Mentalité suisse romande posée et cordiale. Transitions naturelles comme 'alors', 'voilà', 'd'accord'.",
          },
        ],
      },
      {
        idioma: "it",
        idiomaNombre: "Italiano",
        idiomaNeutro: false,
        acentos: [
          {
            id: "CH-it",
            nombre: "Suizo italiano",
            languageCode: "it-CH",
            snippet:
              "Mentalità svizzera italiana, calma e cortese. Transizioni naturali come 'allora', 'va bene', 'giusto'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "DE",
    nombre: "Alemania",
    bandera: "🇩🇪",
    idiomas: [
      {
        idioma: "de",
        idiomaNombre: "Alemán",
        idiomaNeutro: false,
        acentos: [
          {
            id: "DE-de",
            nombre: "Alemán (Alemania)",
            languageCode: "de-DE",
            snippet:
              "Deutsche Mentalität: klar, direkt und professionell. Natürliche Übergänge wie 'also', 'gut', 'genau', 'alles klar'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "AT",
    nombre: "Austria",
    bandera: "🇦🇹",
    idiomas: [
      {
        idioma: "de",
        idiomaNombre: "Alemán",
        idiomaNeutro: false,
        acentos: [
          {
            id: "AT-de",
            nombre: "Austriaco",
            languageCode: "de-AT",
            snippet:
              "Österreichische Mentalität: freundlich und locker. Natürliche Übergänge wie 'also', 'gut', 'servus' (mit Maß), 'passt'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "IT",
    nombre: "Italia",
    bandera: "🇮🇹",
    idiomas: [
      {
        idioma: "it",
        idiomaNombre: "Italiano",
        idiomaNeutro: false,
        acentos: [
          {
            id: "IT-it",
            nombre: "Italiano (Italia)",
            languageCode: "it-IT",
            snippet:
              "Mentalità italiana calda e diretta. Transizioni naturali come 'allora', 'vediamo', 'va bene', 'perfetto'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "NL",
    nombre: "Países Bajos",
    bandera: "🇳🇱",
    idiomas: [
      {
        idioma: "nl",
        idiomaNombre: "Neerlandés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "NL-nl",
            nombre: "Neerlandés",
            languageCode: "nl-NL",
            snippet:
              "Nederlandse mentaliteit: direct maar vriendelijk. Natuurlijke overgangen zoals 'nou', 'goed', 'oké'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "GR",
    nombre: "Grecia",
    bandera: "🇬🇷",
    idiomas: [
      {
        idioma: "el",
        idiomaNombre: "Griego",
        idiomaNeutro: false,
        acentos: [
          { id: "GR-el", nombre: "Griego", languageCode: "el-GR", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "SE",
    nombre: "Suecia",
    bandera: "🇸🇪",
    idiomas: [
      {
        idioma: "sv",
        idiomaNombre: "Sueco",
        idiomaNeutro: false,
        acentos: [
          { id: "SE-sv", nombre: "Sueco", languageCode: "sv-SE", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "NO",
    nombre: "Noruega",
    bandera: "🇳🇴",
    idiomas: [
      {
        idioma: "nb",
        idiomaNombre: "Noruego",
        idiomaNeutro: false,
        acentos: [
          { id: "NO-nb", nombre: "Noruego", languageCode: "nb-NO", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "DK",
    nombre: "Dinamarca",
    bandera: "🇩🇰",
    idiomas: [
      {
        idioma: "da",
        idiomaNombre: "Danés",
        idiomaNeutro: false,
        acentos: [
          { id: "DK-da", nombre: "Danés", languageCode: "da-DK", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "FI",
    nombre: "Finlandia",
    bandera: "🇫🇮",
    idiomas: [
      {
        idioma: "fi",
        idiomaNombre: "Finlandés",
        idiomaNeutro: false,
        acentos: [
          { id: "FI-fi", nombre: "Finlandés", languageCode: "fi-FI", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "PL",
    nombre: "Polonia",
    bandera: "🇵🇱",
    idiomas: [
      {
        idioma: "pl",
        idiomaNombre: "Polaco",
        idiomaNeutro: false,
        acentos: [
          { id: "PL-pl", nombre: "Polaco", languageCode: "pl-PL", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "CZ",
    nombre: "Chequia",
    bandera: "🇨🇿",
    idiomas: [
      {
        idioma: "cs",
        idiomaNombre: "Checo",
        idiomaNeutro: false,
        acentos: [
          { id: "CZ-cs", nombre: "Checo", languageCode: "cs-CZ", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "SK",
    nombre: "Eslovaquia",
    bandera: "🇸🇰",
    idiomas: [
      {
        idioma: "sk",
        idiomaNombre: "Eslovaco",
        idiomaNeutro: false,
        acentos: [
          { id: "SK-sk", nombre: "Eslovaco", languageCode: "sk-SK", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "HU",
    nombre: "Hungría",
    bandera: "🇭🇺",
    idiomas: [
      {
        idioma: "hu",
        idiomaNombre: "Húngaro",
        idiomaNeutro: false,
        acentos: [
          { id: "HU-hu", nombre: "Húngaro", languageCode: "hu-HU", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "RO",
    nombre: "Rumania",
    bandera: "🇷🇴",
    idiomas: [
      {
        idioma: "ro",
        idiomaNombre: "Rumano",
        idiomaNeutro: false,
        acentos: [
          { id: "RO-ro", nombre: "Rumano", languageCode: "ro-RO", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "BG",
    nombre: "Bulgaria",
    bandera: "🇧🇬",
    idiomas: [
      {
        idioma: "bg",
        idiomaNombre: "Búlgaro",
        idiomaNeutro: false,
        acentos: [
          { id: "BG-bg", nombre: "Búlgaro", languageCode: "bg-BG", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "HR",
    nombre: "Croacia",
    bandera: "🇭🇷",
    idiomas: [
      {
        idioma: "hr",
        idiomaNombre: "Croata",
        idiomaNeutro: false,
        acentos: [
          { id: "HR-hr", nombre: "Croata", languageCode: "hr-HR", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "SI",
    nombre: "Eslovenia",
    bandera: "🇸🇮",
    idiomas: [
      {
        idioma: "sl",
        idiomaNombre: "Esloveno",
        idiomaNeutro: false,
        acentos: [
          { id: "SI-sl", nombre: "Esloveno", languageCode: "sl-SI", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "RS",
    nombre: "Serbia",
    bandera: "🇷🇸",
    idiomas: [
      {
        idioma: "sr",
        idiomaNombre: "Serbio",
        idiomaNeutro: false,
        acentos: [
          { id: "RS-sr", nombre: "Serbio", languageCode: "sr-RS", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "AL",
    nombre: "Albania",
    bandera: "🇦🇱",
    idiomas: [
      {
        idioma: "sq",
        idiomaNombre: "Albanés",
        idiomaNeutro: false,
        acentos: [
          { id: "AL-sq", nombre: "Albanés", languageCode: "sq-AL", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "MK",
    nombre: "Macedonia del Norte",
    bandera: "🇲🇰",
    idiomas: [
      {
        idioma: "mk",
        idiomaNombre: "Macedonio",
        idiomaNeutro: false,
        acentos: [
          { id: "MK-mk", nombre: "Macedonio", languageCode: "mk-MK", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "LT",
    nombre: "Lituania",
    bandera: "🇱🇹",
    idiomas: [
      {
        idioma: "lt",
        idiomaNombre: "Lituano",
        idiomaNeutro: false,
        acentos: [
          { id: "LT-lt", nombre: "Lituano", languageCode: "lt-LT", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "LV",
    nombre: "Letonia",
    bandera: "🇱🇻",
    idiomas: [
      {
        idioma: "lv",
        idiomaNombre: "Letón",
        idiomaNeutro: false,
        acentos: [
          { id: "LV-lv", nombre: "Letón", languageCode: "lv-LV", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "EE",
    nombre: "Estonia",
    bandera: "🇪🇪",
    idiomas: [
      {
        idioma: "et",
        idiomaNombre: "Estonio",
        idiomaNeutro: false,
        acentos: [
          { id: "EE-et", nombre: "Estonio", languageCode: "et-EE", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "IS",
    nombre: "Islandia",
    bandera: "🇮🇸",
    idiomas: [
      {
        idioma: "is",
        idiomaNombre: "Islandés",
        idiomaNeutro: false,
        acentos: [
          { id: "IS-is", nombre: "Islandés", languageCode: "is-IS", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "MT",
    nombre: "Malta",
    bandera: "🇲🇹",
    idiomas: [
      {
        idioma: "mt",
        idiomaNombre: "Maltés",
        idiomaNeutro: false,
        acentos: [
          { id: "MT-mt", nombre: "Maltés", languageCode: "mt-MT", snippet: NEUTRO },
        ],
      },
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: true,
        acentos: [
          { id: "MT-en", nombre: "Inglés (neutro)", languageCode: "en-GB", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "CY",
    nombre: "Chipre",
    bandera: "🇨🇾",
    idiomas: [
      {
        idioma: "el",
        idiomaNombre: "Griego",
        idiomaNeutro: false,
        acentos: [
          { id: "CY-el", nombre: "Griego (Chipre)", languageCode: "el-CY", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "UA",
    nombre: "Ucrania",
    bandera: "🇺🇦",
    idiomas: [
      {
        idioma: "uk",
        idiomaNombre: "Ucraniano",
        idiomaNeutro: false,
        acentos: [
          { id: "UA-uk", nombre: "Ucraniano", languageCode: "uk-UA", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "RU",
    nombre: "Rusia",
    bandera: "🇷🇺",
    idiomas: [
      {
        idioma: "ru",
        idiomaNombre: "Ruso",
        idiomaNeutro: false,
        acentos: [
          { id: "RU-ru", nombre: "Ruso", languageCode: "ru-RU", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "TR",
    nombre: "Turquía",
    bandera: "🇹🇷",
    idiomas: [
      {
        idioma: "tr",
        idiomaNombre: "Turco",
        idiomaNeutro: false,
        acentos: [
          { id: "TR-tr", nombre: "Turco", languageCode: "tr-TR", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "AD",
    nombre: "Andorra",
    bandera: "🇦🇩",
    idiomas: [
      {
        idioma: "ca",
        idiomaNombre: "Catalán",
        idiomaNeutro: false,
        acentos: [
          { id: "AD-ca", nombre: "Catalán", languageCode: "ca-AD", snippet: NEUTRO },
        ],
      },
      {
        idioma: "es",
        idiomaNombre: "Español",
        idiomaNeutro: true,
        acentos: [
          { id: "AD-es", nombre: "Español (neutro)", languageCode: "es-419", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "MC",
    nombre: "Mónaco",
    bandera: "🇲🇨",
    idiomas: [
      {
        idioma: "fr",
        idiomaNombre: "Francés",
        idiomaNeutro: false,
        acentos: [
          { id: "MC-fr", nombre: "Francés (Mónaco)", languageCode: "fr-FR", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "SM",
    nombre: "San Marino",
    bandera: "🇸🇲",
    idiomas: [
      {
        idioma: "it",
        idiomaNombre: "Italiano",
        idiomaNeutro: false,
        acentos: [
          { id: "SM-it", nombre: "Italiano (San Marino)", languageCode: "it-IT", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "LI",
    nombre: "Liechtenstein",
    bandera: "🇱🇮",
    idiomas: [
      {
        idioma: "de",
        idiomaNombre: "Alemán",
        idiomaNeutro: false,
        acentos: [
          { id: "LI-de", nombre: "Alemán (Liechtenstein)", languageCode: "de-CH", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "AU",
    nombre: "Australia",
    bandera: "🇦🇺",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "AU-en",
            nombre: "Australiano",
            languageCode: "en-AU",
            snippet:
              "Australian relaxed and friendly mindset. Natural transitions like 'right', 'fair enough', 'no worries', 'let me see'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "NZ",
    nombre: "Nueva Zelanda",
    bandera: "🇳🇿",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "NZ-en",
            nombre: "Neozelandés",
            languageCode: "en-NZ",
            snippet:
              "New Zealand warm and easy-going mindset. Natural transitions like 'right', 'yeah', 'no worries', 'sweet as'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "ZA",
    nombre: "Sudáfrica",
    bandera: "🇿🇦",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "ZA-en",
            nombre: "Sudafricano",
            languageCode: "en-ZA",
            snippet:
              "South African friendly and warm mindset. Natural transitions like 'right', 'alright', 'ja', 'let me see'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "IN",
    nombre: "India",
    bandera: "🇮🇳",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "IN-en",
            nombre: "Inglés indio",
            languageCode: "en-IN",
            snippet:
              "Indian English: courteous and clear, slightly formal. Natural transitions like 'okay', 'right', 'let me check', 'no problem'.",
          },
        ],
      },
      {
        idioma: "hi",
        idiomaNombre: "Hindi",
        idiomaNeutro: false,
        acentos: [
          {
            id: "IN-hi",
            nombre: "Hindi",
            languageCode: "hi-IN",
            snippet:
              "भारतीय हिंदी में मिलनसार और विनम्र ढंग से बात करें। स्वाभाविक शब्द: 'अच्छा', 'ठीक है', 'देखते हैं'।",
          },
        ],
      },
    ],
  },
  {
    codigo: "SG",
    nombre: "Singapur",
    bandera: "🇸🇬",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "SG-en",
            nombre: "Inglés (Singapur)",
            languageCode: "en-SG",
            snippet:
              "Singapore English: polite, efficient and friendly. Natural transitions like 'okay', 'right', 'alright'.",
          },
        ],
      },
      {
        idioma: "zh",
        idiomaNombre: "Chino mandarín",
        idiomaNeutro: true,
        acentos: [
          { id: "SG-zh", nombre: "Mandarín (neutro)", languageCode: "zh-CN", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "PH",
    nombre: "Filipinas",
    bandera: "🇵🇭",
    idiomas: [
      {
        idioma: "en",
        idiomaNombre: "Inglés",
        idiomaNeutro: false,
        acentos: [
          {
            id: "PH-en",
            nombre: "Inglés (Filipinas)",
            languageCode: "en-PH",
            snippet:
              "Filipino English: warm and courteous. Natural transitions like 'okay', 'po', 'right' (with light use).",
          },
        ],
      },
      {
        idioma: "fil",
        idiomaNombre: "Filipino",
        idiomaNeutro: false,
        acentos: [
          { id: "PH-fil", nombre: "Filipino", languageCode: "fil-PH", snippet: NEUTRO },
        ],
      },
    ],
  },
  {
    codigo: "EG",
    nombre: "Egipto",
    bandera: "🇪🇬",
    idiomas: [
      {
        idioma: "ar",
        idiomaNombre: "Árabe",
        idiomaNeutro: false,
        acentos: [
          {
            id: "EG-ar",
            nombre: "Árabe egipcio",
            languageCode: "ar-EG",
            snippet:
              "لهجة مصرية ودودة وواضحة. استخدم عبارات انتقالية طبيعية مثل 'طيب'، 'ماشي'، 'حاضر'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "SA",
    nombre: "Arabia Saudita",
    bandera: "🇸🇦",
    idiomas: [
      {
        idioma: "ar",
        idiomaNombre: "Árabe",
        idiomaNeutro: false,
        acentos: [
          {
            id: "SA-ar",
            nombre: "Árabe (Arabia Saudita)",
            languageCode: "ar-SA",
            snippet:
              "لهجة سعودية مهذبة ومباشرة. استخدم عبارات طبيعية مثل 'طيب'، 'تمام'، 'حاضر'.",
          },
        ],
      },
    ],
  },
  {
    codigo: "AE",
    nombre: "Emiratos Árabes",
    bandera: "🇦🇪",
    idiomas: [
      {
        idioma: "ar",
        idiomaNombre: "Árabe",
        idiomaNeutro: false,
        acentos: [
          {
            id: "AE-ar",
            nombre: "Árabe (Emiratos)",
            languageCode: "ar-AE",
            snippet:
              "لهجة إماراتية مهذبة وواضحة. استخدم عبارات طبيعية مثل 'طيب'، 'تمام'، 'حاضر'.",
          },
        ],
      },
    ],
  },
];

/** Índice de acentos por id persistido (settings.aiRegion). */
export const REGIONES: Record<string, AcentoGemini> = {};
for (const p of PAISES) {
  for (const l of p.idiomas) {
    for (const a of l.acentos) {
      REGIONES[a.id] = a;
    }
  }
}

/** Códigos antiguos (pre-jerarquía de países) → id actual. Para datos viejos. */
const ALIAS_LEGADO: Record<string, string> = {
  "es-MX": "MX-es",
  "es-US": "US-es",
  "es-ES": "ES-es",
  "es-AR": "AR-es",
  "es-CO": "CO-es",
  "en-US": "US-en",
  "en-GB": "GB-en",
  "pt-BR": "BR-pt",
};

export const REGION_DEFAULT = "MX-es";

function normalizarId(id?: string | null): string {
  return (id || "") in ALIAS_LEGADO ? ALIAS_LEGADO[id || ""] : (id || "");
}

/** Devuelve el acento completo (id, nombre, languageCode, snippet). */
export function obtenerAcento(aiRegion?: string | null): AcentoGemini {
  return REGIONES[normalizarId(aiRegion)] ?? REGIONES[REGION_DEFAULT];
}

export function obtenerRegion(aiRegion?: string | null): RegionGemini {
  const acento = obtenerAcento(aiRegion);
  return { languageCode: acento.languageCode, snippet: acento.snippet };
}

/**
 * Deriva el idioma (es, en, pt…) SIEMPRE desde el acento configurado.
 * El idioma nunca se configura libre: viene del id "PAIS-idioma".
 */
export function derivarIdiomaDeRegion(aiRegion?: string | null): string {
  const id = normalizarId(aiRegion);
  if (!id) return "es";
  const partes = id.split("-");
  return partes.length === 2 ? partes[1] : "es";
}

/**
 * Directivas de comportamiento humano para el modo nativo de voz. Aplican a
 * todos los idiomas/regiones, calibradas a SUTIL para no sonar forzado.
 */
export const HUMANIZACION_BASE = `
## NATURALIDAD HUMANA (CRÍTICO)
- Eres una voz humana real en una llamada: NO hables de corrido ni como si leyeras un guion.
- Introduce pausas orgánicas breves entre ideas; piensa en voz alta un instante cuando corresponda.
- Antes de frases largas o de cambiar de tema, haz una aspiración/breve toma de aire audible, sutil.
- De vez en cuando trábate levemente al iniciar una palabra o corrígete con naturalidad: "bueno, más bien…", "déjame ver…".
- Usa muletillas de escucha activa y transición con moderación: "ajá", "sí…", "mmh", "ok", "listo".
- No abuses de estos recursos: deben sonar espontáneos, nunca exagerados ni forzados.
- Mantén el tono profesional del negocio, pero cálido y cercano.`.trim();
