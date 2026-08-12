/**
 * Espejo del dataset PAISES del backend (backend-express/src/utils/region.ts).
 * Mantener en sync: la estructura es la misma pero aquí los acentos NO llevan
 * snippet (solo la UI). El id del acento ("PAIS-idioma") es lo que se persiste
 * en settings.aiRegion.
 */

export interface AcentoUI {
  id: string;
  nombre: string;
  languageCode: string;
}

export interface IdiomaUI {
  idioma: string;
  idiomaNombre: string;
  idiomaNeutro: boolean;
  acentos: AcentoUI[];
}

export interface PaisUI {
  codigo: string;
  nombre: string;
  bandera: string;
  idiomas: IdiomaUI[];
}

export const PAISES: PaisUI[] = [
  {
    codigo: "US",
    nombre: "Estados Unidos",
    bandera: "🇺🇸",
    idiomas: [
      { idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "US-en", nombre: "Estadounidense", languageCode: "en-US" }] },
      { idioma: "es", idiomaNombre: "Español", idiomaNeutro: true, acentos: [{ id: "US-es", nombre: "Español (neutro EE.UU.)", languageCode: "es-US" }] },
    ],
  },
  {
    codigo: "CA",
    nombre: "Canadá",
    bandera: "🇨🇦",
    idiomas: [
      { idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "CA-en", nombre: "Canadiense", languageCode: "en-CA" }] },
      { idioma: "fr", idiomaNombre: "Francés", idiomaNeutro: false, acentos: [{ id: "CA-fr", nombre: "Francés canadiense", languageCode: "fr-CA" }] },
    ],
  },
  { codigo: "MX", nombre: "México", bandera: "🇲🇽", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "MX-es", nombre: "Mexicano", languageCode: "es-MX" }] }] },
  { codigo: "GT", nombre: "Guatemala", bandera: "🇬🇹", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "GT-es", nombre: "Guatemalteco", languageCode: "es-GT" }] }] },
  { codigo: "HN", nombre: "Honduras", bandera: "🇭🇳", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "HN-es", nombre: "Hondureño", languageCode: "es-HN" }] }] },
  { codigo: "SV", nombre: "El Salvador", bandera: "🇸🇻", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "SV-es", nombre: "Salvadoreño", languageCode: "es-SV" }] }] },
  { codigo: "NI", nombre: "Nicaragua", bandera: "🇳🇮", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "NI-es", nombre: "Nicaragüense", languageCode: "es-NI" }] }] },
  { codigo: "CR", nombre: "Costa Rica", bandera: "🇨🇷", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "CR-es", nombre: "Costarricense", languageCode: "es-CR" }] }] },
  { codigo: "PA", nombre: "Panamá", bandera: "🇵🇦", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "PA-es", nombre: "Panameño", languageCode: "es-PA" }] }] },
  { codigo: "CU", nombre: "Cuba", bandera: "🇨🇺", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "CU-es", nombre: "Cubano", languageCode: "es-CU" }] }] },
  { codigo: "DO", nombre: "República Dominicana", bandera: "🇩🇴", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "DO-es", nombre: "Dominicano", languageCode: "es-DO" }] }] },
  {
    codigo: "PR",
    nombre: "Puerto Rico",
    bandera: "🇵🇷",
    idiomas: [
      { idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "PR-es", nombre: "Puertorriqueño", languageCode: "es-PR" }] },
      { idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: true, acentos: [{ id: "PR-en", nombre: "Inglés (neutro)", languageCode: "en-US" }] },
    ],
  },
  { codigo: "CO", nombre: "Colombia", bandera: "🇨🇴", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "CO-es", nombre: "Colombiano", languageCode: "es-CO" }] }] },
  { codigo: "VE", nombre: "Venezuela", bandera: "🇻🇪", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "VE-es", nombre: "Venezolano", languageCode: "es-VE" }] }] },
  { codigo: "EC", nombre: "Ecuador", bandera: "🇪🇨", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "EC-es", nombre: "Ecuatoriano", languageCode: "es-EC" }] }] },
  { codigo: "PE", nombre: "Perú", bandera: "🇵🇪", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "PE-es", nombre: "Peruano", languageCode: "es-PE" }] }] },
  { codigo: "BO", nombre: "Bolivia", bandera: "🇧🇴", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "BO-es", nombre: "Boliviano", languageCode: "es-BO" }] }] },
  { codigo: "CL", nombre: "Chile", bandera: "🇨🇱", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "CL-es", nombre: "Chileno", languageCode: "es-CL" }] }] },
  { codigo: "AR", nombre: "Argentina", bandera: "🇦🇷", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "AR-es", nombre: "Argentino (rioplatense)", languageCode: "es-AR" }] }] },
  { codigo: "UY", nombre: "Uruguay", bandera: "🇺🇾", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "UY-es", nombre: "Uruguayo", languageCode: "es-UY" }] }] },
  { codigo: "PY", nombre: "Paraguay", bandera: "🇵🇾", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "PY-es", nombre: "Paraguayo", languageCode: "es-PY" }] }] },
  { codigo: "ES", nombre: "España", bandera: "🇪🇸", idiomas: [{ idioma: "es", idiomaNombre: "Español", idiomaNeutro: false, acentos: [{ id: "ES-es", nombre: "Español (España)", languageCode: "es-ES" }] }] },
  { codigo: "GB", nombre: "Reino Unido", bandera: "🇬🇧", idiomas: [{ idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "GB-en", nombre: "Británico", languageCode: "en-GB" }] }] },
  { codigo: "IE", nombre: "Irlanda", bandera: "🇮🇪", idiomas: [{ idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "IE-en", nombre: "Irlandés", languageCode: "en-IE" }] }] },
  { codigo: "PT", nombre: "Portugal", bandera: "🇵🇹", idiomas: [{ idioma: "pt", idiomaNombre: "Portugués", idiomaNeutro: false, acentos: [{ id: "PT-pt", nombre: "Portugués europeo", languageCode: "pt-PT" }] }] },
  { codigo: "BR", nombre: "Brasil", bandera: "🇧🇷", idiomas: [{ idioma: "pt", idiomaNombre: "Portugués", idiomaNeutro: false, acentos: [{ id: "BR-pt", nombre: "Brasileño", languageCode: "pt-BR" }] }] },
  { codigo: "FR", nombre: "Francia", bandera: "🇫🇷", idiomas: [{ idioma: "fr", idiomaNombre: "Francés", idiomaNeutro: false, acentos: [{ id: "FR-fr", nombre: "Francés (Francia)", languageCode: "fr-FR" }] }] },
  {
    codigo: "BE",
    nombre: "Bélgica",
    bandera: "🇧🇪",
    idiomas: [
      { idioma: "nl", idiomaNombre: "Neerlandés", idiomaNeutro: false, acentos: [{ id: "BE-nl", nombre: "Flamenco", languageCode: "nl-BE" }] },
      { idioma: "fr", idiomaNombre: "Francés", idiomaNeutro: false, acentos: [{ id: "BE-fr", nombre: "Francés belga", languageCode: "fr-BE" }] },
      { idioma: "de", idiomaNombre: "Alemán", idiomaNeutro: true, acentos: [{ id: "BE-de", nombre: "Alemán (neutro)", languageCode: "de-DE" }] },
    ],
  },
  {
    codigo: "CH",
    nombre: "Suiza",
    bandera: "🇨🇭",
    idiomas: [
      { idioma: "de", idiomaNombre: "Alemán", idiomaNeutro: false, acentos: [{ id: "CH-de", nombre: "Suizo alemán", languageCode: "de-CH" }] },
      { idioma: "fr", idiomaNombre: "Francés", idiomaNeutro: false, acentos: [{ id: "CH-fr", nombre: "Suizo francés", languageCode: "fr-CH" }] },
      { idioma: "it", idiomaNombre: "Italiano", idiomaNeutro: false, acentos: [{ id: "CH-it", nombre: "Suizo italiano", languageCode: "it-CH" }] },
    ],
  },
  { codigo: "DE", nombre: "Alemania", bandera: "🇩🇪", idiomas: [{ idioma: "de", idiomaNombre: "Alemán", idiomaNeutro: false, acentos: [{ id: "DE-de", nombre: "Alemán (Alemania)", languageCode: "de-DE" }] }] },
  { codigo: "AT", nombre: "Austria", bandera: "🇦🇹", idiomas: [{ idioma: "de", idiomaNombre: "Alemán", idiomaNeutro: false, acentos: [{ id: "AT-de", nombre: "Austriaco", languageCode: "de-AT" }] }] },
  { codigo: "IT", nombre: "Italia", bandera: "🇮🇹", idiomas: [{ idioma: "it", idiomaNombre: "Italiano", idiomaNeutro: false, acentos: [{ id: "IT-it", nombre: "Italiano (Italia)", languageCode: "it-IT" }] }] },
  { codigo: "NL", nombre: "Países Bajos", bandera: "🇳🇱", idiomas: [{ idioma: "nl", idiomaNombre: "Neerlandés", idiomaNeutro: false, acentos: [{ id: "NL-nl", nombre: "Neerlandés", languageCode: "nl-NL" }] }] },
  { codigo: "GR", nombre: "Grecia", bandera: "🇬🇷", idiomas: [{ idioma: "el", idiomaNombre: "Griego", idiomaNeutro: false, acentos: [{ id: "GR-el", nombre: "Griego", languageCode: "el-GR" }] }] },
  { codigo: "SE", nombre: "Suecia", bandera: "🇸🇪", idiomas: [{ idioma: "sv", idiomaNombre: "Sueco", idiomaNeutro: false, acentos: [{ id: "SE-sv", nombre: "Sueco", languageCode: "sv-SE" }] }] },
  { codigo: "NO", nombre: "Noruega", bandera: "🇳🇴", idiomas: [{ idioma: "nb", idiomaNombre: "Noruego", idiomaNeutro: false, acentos: [{ id: "NO-nb", nombre: "Noruego", languageCode: "nb-NO" }] }] },
  { codigo: "DK", nombre: "Dinamarca", bandera: "🇩🇰", idiomas: [{ idioma: "da", idiomaNombre: "Danés", idiomaNeutro: false, acentos: [{ id: "DK-da", nombre: "Danés", languageCode: "da-DK" }] }] },
  { codigo: "FI", nombre: "Finlandia", bandera: "🇫🇮", idiomas: [{ idioma: "fi", idiomaNombre: "Finlandés", idiomaNeutro: false, acentos: [{ id: "FI-fi", nombre: "Finlandés", languageCode: "fi-FI" }] }] },
  { codigo: "PL", nombre: "Polonia", bandera: "🇵🇱", idiomas: [{ idioma: "pl", idiomaNombre: "Polaco", idiomaNeutro: false, acentos: [{ id: "PL-pl", nombre: "Polaco", languageCode: "pl-PL" }] }] },
  { codigo: "CZ", nombre: "Chequia", bandera: "🇨🇿", idiomas: [{ idioma: "cs", idiomaNombre: "Checo", idiomaNeutro: false, acentos: [{ id: "CZ-cs", nombre: "Checo", languageCode: "cs-CZ" }] }] },
  { codigo: "SK", nombre: "Eslovaquia", bandera: "🇸🇰", idiomas: [{ idioma: "sk", idiomaNombre: "Eslovaco", idiomaNeutro: false, acentos: [{ id: "SK-sk", nombre: "Eslovaco", languageCode: "sk-SK" }] }] },
  { codigo: "HU", nombre: "Hungría", bandera: "🇭🇺", idiomas: [{ idioma: "hu", idiomaNombre: "Húngaro", idiomaNeutro: false, acentos: [{ id: "HU-hu", nombre: "Húngaro", languageCode: "hu-HU" }] }] },
  { codigo: "RO", nombre: "Rumania", bandera: "🇷🇴", idiomas: [{ idioma: "ro", idiomaNombre: "Rumano", idiomaNeutro: false, acentos: [{ id: "RO-ro", nombre: "Rumano", languageCode: "ro-RO" }] }] },
  { codigo: "BG", nombre: "Bulgaria", bandera: "🇧🇬", idiomas: [{ idioma: "bg", idiomaNombre: "Búlgaro", idiomaNeutro: false, acentos: [{ id: "BG-bg", nombre: "Búlgaro", languageCode: "bg-BG" }] }] },
  { codigo: "HR", nombre: "Croacia", bandera: "🇭🇷", idiomas: [{ idioma: "hr", idiomaNombre: "Croata", idiomaNeutro: false, acentos: [{ id: "HR-hr", nombre: "Croata", languageCode: "hr-HR" }] }] },
  { codigo: "SI", nombre: "Eslovenia", bandera: "🇸🇮", idiomas: [{ idioma: "sl", idiomaNombre: "Esloveno", idiomaNeutro: false, acentos: [{ id: "SI-sl", nombre: "Esloveno", languageCode: "sl-SI" }] }] },
  { codigo: "RS", nombre: "Serbia", bandera: "🇷🇸", idiomas: [{ idioma: "sr", idiomaNombre: "Serbio", idiomaNeutro: false, acentos: [{ id: "RS-sr", nombre: "Serbio", languageCode: "sr-RS" }] }] },
  { codigo: "AL", nombre: "Albania", bandera: "🇦🇱", idiomas: [{ idioma: "sq", idiomaNombre: "Albanés", idiomaNeutro: false, acentos: [{ id: "AL-sq", nombre: "Albanés", languageCode: "sq-AL" }] }] },
  { codigo: "MK", nombre: "Macedonia del Norte", bandera: "🇲🇰", idiomas: [{ idioma: "mk", idiomaNombre: "Macedonio", idiomaNeutro: false, acentos: [{ id: "MK-mk", nombre: "Macedonio", languageCode: "mk-MK" }] }] },
  { codigo: "LT", nombre: "Lituania", bandera: "🇱🇹", idiomas: [{ idioma: "lt", idiomaNombre: "Lituano", idiomaNeutro: false, acentos: [{ id: "LT-lt", nombre: "Lituano", languageCode: "lt-LT" }] }] },
  { codigo: "LV", nombre: "Letonia", bandera: "🇱🇻", idiomas: [{ idioma: "lv", idiomaNombre: "Letón", idiomaNeutro: false, acentos: [{ id: "LV-lv", nombre: "Letón", languageCode: "lv-LV" }] }] },
  { codigo: "EE", nombre: "Estonia", bandera: "🇪🇪", idiomas: [{ idioma: "et", idiomaNombre: "Estonio", idiomaNeutro: false, acentos: [{ id: "EE-et", nombre: "Estonio", languageCode: "et-EE" }] }] },
  { codigo: "IS", nombre: "Islandia", bandera: "🇮🇸", idiomas: [{ idioma: "is", idiomaNombre: "Islandés", idiomaNeutro: false, acentos: [{ id: "IS-is", nombre: "Islandés", languageCode: "is-IS" }] }] },
  {
    codigo: "MT",
    nombre: "Malta",
    bandera: "🇲🇹",
    idiomas: [
      { idioma: "mt", idiomaNombre: "Maltés", idiomaNeutro: false, acentos: [{ id: "MT-mt", nombre: "Maltés", languageCode: "mt-MT" }] },
      { idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: true, acentos: [{ id: "MT-en", nombre: "Inglés (neutro)", languageCode: "en-GB" }] },
    ],
  },
  { codigo: "CY", nombre: "Chipre", bandera: "🇨🇾", idiomas: [{ idioma: "el", idiomaNombre: "Griego", idiomaNeutro: false, acentos: [{ id: "CY-el", nombre: "Griego (Chipre)", languageCode: "el-CY" }] }] },
  { codigo: "UA", nombre: "Ucrania", bandera: "🇺🇦", idiomas: [{ idioma: "uk", idiomaNombre: "Ucraniano", idiomaNeutro: false, acentos: [{ id: "UA-uk", nombre: "Ucraniano", languageCode: "uk-UA" }] }] },
  { codigo: "RU", nombre: "Rusia", bandera: "🇷🇺", idiomas: [{ idioma: "ru", idiomaNombre: "Ruso", idiomaNeutro: false, acentos: [{ id: "RU-ru", nombre: "Ruso", languageCode: "ru-RU" }] }] },
  { codigo: "TR", nombre: "Turquía", bandera: "🇹🇷", idiomas: [{ idioma: "tr", idiomaNombre: "Turco", idiomaNeutro: false, acentos: [{ id: "TR-tr", nombre: "Turco", languageCode: "tr-TR" }] }] },
  {
    codigo: "AD",
    nombre: "Andorra",
    bandera: "🇦🇩",
    idiomas: [
      { idioma: "ca", idiomaNombre: "Catalán", idiomaNeutro: false, acentos: [{ id: "AD-ca", nombre: "Catalán", languageCode: "ca-AD" }] },
      { idioma: "es", idiomaNombre: "Español", idiomaNeutro: true, acentos: [{ id: "AD-es", nombre: "Español (neutro)", languageCode: "es-419" }] },
    ],
  },
  { codigo: "MC", nombre: "Mónaco", bandera: "🇲🇨", idiomas: [{ idioma: "fr", idiomaNombre: "Francés", idiomaNeutro: false, acentos: [{ id: "MC-fr", nombre: "Francés (Mónaco)", languageCode: "fr-FR" }] }] },
  { codigo: "SM", nombre: "San Marino", bandera: "🇸🇲", idiomas: [{ idioma: "it", idiomaNombre: "Italiano", idiomaNeutro: false, acentos: [{ id: "SM-it", nombre: "Italiano (San Marino)", languageCode: "it-IT" }] }] },
  { codigo: "LI", nombre: "Liechtenstein", bandera: "🇱🇮", idiomas: [{ idioma: "de", idiomaNombre: "Alemán", idiomaNeutro: false, acentos: [{ id: "LI-de", nombre: "Alemán (Liechtenstein)", languageCode: "de-CH" }] }] },
  { codigo: "AU", nombre: "Australia", bandera: "🇦🇺", idiomas: [{ idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "AU-en", nombre: "Australiano", languageCode: "en-AU" }] }] },
  { codigo: "NZ", nombre: "Nueva Zelanda", bandera: "🇳🇿", idiomas: [{ idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "NZ-en", nombre: "Neozelandés", languageCode: "en-NZ" }] }] },
  { codigo: "ZA", nombre: "Sudáfrica", bandera: "🇿🇦", idiomas: [{ idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "ZA-en", nombre: "Sudafricano", languageCode: "en-ZA" }] }] },
  {
    codigo: "IN",
    nombre: "India",
    bandera: "🇮🇳",
    idiomas: [
      { idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "IN-en", nombre: "Inglés indio", languageCode: "en-IN" }] },
      { idioma: "hi", idiomaNombre: "Hindi", idiomaNeutro: false, acentos: [{ id: "IN-hi", nombre: "Hindi", languageCode: "hi-IN" }] },
    ],
  },
  {
    codigo: "SG",
    nombre: "Singapur",
    bandera: "🇸🇬",
    idiomas: [
      { idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "SG-en", nombre: "Inglés (Singapur)", languageCode: "en-SG" }] },
      { idioma: "zh", idiomaNombre: "Chino mandarín", idiomaNeutro: true, acentos: [{ id: "SG-zh", nombre: "Mandarín (neutro)", languageCode: "zh-CN" }] },
    ],
  },
  {
    codigo: "PH",
    nombre: "Filipinas",
    bandera: "🇵🇭",
    idiomas: [
      { idioma: "en", idiomaNombre: "Inglés", idiomaNeutro: false, acentos: [{ id: "PH-en", nombre: "Inglés (Filipinas)", languageCode: "en-PH" }] },
      { idioma: "fil", idiomaNombre: "Filipino", idiomaNeutro: false, acentos: [{ id: "PH-fil", nombre: "Filipino", languageCode: "fil-PH" }] },
    ],
  },
  { codigo: "EG", nombre: "Egipto", bandera: "🇪🇬", idiomas: [{ idioma: "ar", idiomaNombre: "Árabe", idiomaNeutro: false, acentos: [{ id: "EG-ar", nombre: "Árabe egipcio", languageCode: "ar-EG" }] }] },
  { codigo: "SA", nombre: "Arabia Saudita", bandera: "🇸🇦", idiomas: [{ idioma: "ar", idiomaNombre: "Árabe", idiomaNeutro: false, acentos: [{ id: "SA-ar", nombre: "Árabe (Arabia Saudita)", languageCode: "ar-SA" }] }] },
  { codigo: "AE", nombre: "Emiratos Árabes", bandera: "🇦🇪", idiomas: [{ idioma: "ar", idiomaNombre: "Árabe", idiomaNeutro: false, acentos: [{ id: "AE-ar", nombre: "Árabe (Emiratos)", languageCode: "ar-AE" }] }] },
];

/** Deriva el idioma (es, en, pt…) desde el id del acento "PAIS-idioma". */
export function derivarIdiomaDeRegion(aiRegion?: string | null): string {
  const id = (aiRegion || "").split("-");
  return id.length === 2 ? id[1] : "es";
}
