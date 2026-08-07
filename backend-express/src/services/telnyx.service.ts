/**
 * Telnyx Service - Wrapper API para telefonía.
 * Proveedor de telefonía: subcuentas, compra números, TeXML, webhooks.
 * Tu pipeline Gemini (STT/LLM/TTS) permanece intacto.
 */
import { logger } from "../utils/logger";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;
const TELNYX_ORG_ID = process.env.TELNYX_ORG_ID; // optional: solo para child accounts

/**
 * Crea una cuenta hija completa con API Key y conexión de voz configurada.
 * Retorna todo lo necesario para que el cliente empiece a recibir llamadas.
 * Requiere TELNYX_ORG_ID configurado (plan Telnyx $1000/mes).
 */
export async function createChildAccountWithSetup(
  accountName: string,
  email: string,
  webhookBaseUrl: string
): Promise<{
  childAccount: ChildAccount;
  apiKey: string;
  connectionId: string;
}> {
  // 1. Crear child account
  const childAccount = await createChildAccount(accountName, email);
  
  // 2. Generar API Key para la cuenta hija
  const apiKeyData = await createApiKeyForAccount(childAccount.id, `VozIA-${accountName}`);
  const apiKey = apiKeyData.key;
  
  // 3. Crear conexión de voz (WebSocket) para streaming
  const webhookUrl = `${webhookBaseUrl}/webhooks/telnyx/voice`;
  const connection = await createVoiceConnection(
    `VozIA-${accountName}`,
    webhookUrl,
    childAccount.id
  );
  
  // 4. Configurar webhooks en la cuenta (nivel cuenta)
  await setupChildAccountWebhooks(childAccount.id, webhookBaseUrl);
  
  logger.info({ 
    childAccountId: childAccount.id, 
    connectionId: connection.id,
    accountName 
  }, "Child account configurada completamente");
  
  return {
    childAccount,
    apiKey: apiKeyData.key,
    connectionId: connection.id,
  };
}

/**
 * Configura webhooks en la cuenta hija (nivel account).
 * POST /v2/accounts/{account_id}/webhooks
 */
export async function setupChildAccountWebhooks(
  childAccountId: string,
  webhookBaseUrl: string
): Promise<void> {
  const webhookUrl = `${webhookBaseUrl}/webhooks/telnyx/voice`;
  
  try {
    // Configurar webhook a nivel de cuenta para eventos de llamada
    await telnyxFetch(
      `/accounts/${childAccountId}/webhooks`,
      {
        method: "POST",
        body: JSON.stringify({
          url: webhookUrl,
          failover_url: webhookUrl,
          events: [
            "call.initiated",
            "call.answered", 
            "call.hangup",
            "call.recording.saved"
          ],
        }),
      }
    );
    
    logger.info({ childAccountId, webhookUrl }, "Webhooks configurados en child account");
  } catch (e) {
    logger.warn({ error: (e as Error).message, childAccountId }, "Error configurando webhooks en child account");
    // No lanzar error - los webhooks a nivel de número también funcionan
  }
}

export interface ChildAccountSetupResult {
  childAccount: ChildAccount;
  apiKey: string;
  connectionId: string;
}

function telnyxHeaders(): HeadersInit {
  return {
    "Authorization": `Bearer ${TELNYX_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

async function telnyxFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${TELNYX_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...telnyxHeaders(),
      ...options.headers,
    },
  });

  // Capturar rate limit headers de Telnyx
  const headers: Record<string, string | undefined> = {};
  res.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith("x-ratelimit")) {
      headers[key] = value;
    }
  });
  if (Object.keys(headers).length > 0) {
    const { actualizarRateLimitTelnyx } = await import("./ratelimit.service");
    actualizarRateLimitTelnyx(headers).catch((e) =>
      console.error("Error actualizando rate limit Telnyx:", e)
    );
  }

  if (!res.ok) {
    const errorText = await res.text();
    logger.error({ path, status: res.status, error: errorText }, "Telnyx API error");
    throw new Error(`Telnyx API ${res.status}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Crea una cuenta hija (child account) para un cliente.
 * En Telnyx v2: POST /v2/organizations/{org_id}/child_accounts
 * Requiere TELNYX_ORG_ID configurado (plan Telnyx $1000/mes).
 */
export async function createChildAccount(accountName: string, email?: string): Promise<ChildAccount> {
  if (!TELNYX_ORG_ID) {
    throw new Error("TELNYX_ORG_ID no configurado. Requiere plan Telnyx $1000/mes para child accounts.");
  }
  const data = await telnyxFetch<{ data: ChildAccount }>(
    `/organizations/${TELNYX_ORG_ID}/child_accounts`,
    {
      method: "POST",
      body: JSON.stringify({
        account_name: accountName,
        email,
        legal_entity: {
          type: "individual",
        },
      }),
    }
  );

  logger.info({ accountName, childAccountId: data.data.id }, "Child account creada");
  return data.data;
}

/**
 * Genera API Key para una cuenta hija.
 * POST /v2/api_keys
 */
export async function createApiKeyForAccount(accountId: string, name: string): Promise<{ id: string; key: string }> {
  const data = await telnyxFetch<{ data: { id: string; key: string } }>(
    `/api_keys`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        account_id: accountId,
        expires_at: null, // No expira
      }),
    }
  );

  return data.data;
}

/**
 * Busca números disponibles.
 * GET /v2/available_phone_numbers?country_code=US&features[]=voice
 */
export async function searchAvailableNumbers(
  countryCode: string,
  areaCode?: string,
  limit = 20,
  page = 1
): Promise<{ numbers: TelnyxPhoneNumber[]; total: number | null }> {
  const params = new URLSearchParams({
    "filter[country_code]": countryCode,
    "filter[features][]": "voice",
    "page[size]": String(limit),
    "page[number]": String(page),
  });
  if (areaCode) {
    params.append("filter[national_destination_code]", areaCode);
  }

  const data = await telnyxFetch<{
    data: TelnyxPhoneNumber[];
    meta?: { total_results?: number; total_pages?: number };
  }>(`/available_phone_numbers?${params.toString()}`);

  return {
    numbers: data.data ?? [],
    total: data.meta?.total_results ?? null,
  };
}

/**
 * Busca un número disponible exacto para obtener su costo confiable
 * (filter[phone_number]). Retorna null si ya no está disponible.
 */
export async function getAvailableNumberByPhone(
  phoneNumber: string
): Promise<TelnyxPhoneNumber | null> {
  try {
    const params = new URLSearchParams({
      "filter[phone_number][]": phoneNumber,
      "page[size]": "1",
    });
    const data = await telnyxFetch<{ data: TelnyxPhoneNumber[] }>(
      `/available_phone_numbers?${params.toString()}`
    );
    return data.data?.[0] ?? null;
  } catch (e) {
    logger.warn({ error: (e as Error).message, phoneNumber }, "No se pudo consultar costo del número");
    return null;
  }
}

/**
 * Compra un número telefónico y lo asigna a una cuenta hija.
 * POST /v2/phone_numbers
 */
export async function purchasePhoneNumber(
  phoneNumber: string,
  childAccountId?: string,
  connectionId?: string
): Promise<TelnyxPhoneNumber> {
  // La compra en Telnyx v2 es POST /v2/number_orders con array phone_numbers
  const body: Record<string, unknown> = {
    phone_numbers: [{ phone_number: phoneNumber }],
  };
  if (childAccountId) {
    body.account_id = childAccountId;
  }
  if (connectionId) {
    body.connection_id = connectionId;
  }

  const data = await telnyxFetch<{ data: Record<string, unknown> }>(
    "/number_orders",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  // La respuesta es un number_order; extraer el número comprado si viene incluido
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bought = (data.data as any)?.phone_numbers?.[0];
  const comprado: TelnyxPhoneNumber | null =
    bought?.id ? (bought as TelnyxPhoneNumber) : await getOwnedNumberByPhone(phoneNumber);

  if (!comprado) {
    throw new Error(`Número ${phoneNumber} ordenado pero no se pudo obtener su registro`);
  }

  logger.info({ phoneNumber, childAccountId }, "Número comprado en Telnyx");
  return comprado;
}

/**
 * Crea una llamada saliente vía Call Control.
 * POST /v2/calls. El webhook de voz recibe direction=outgoing y
 * client_state con el userId para enrutar la sesión de IA.
 */
export async function createOutboundCall(params: {
  from: string;
  to: string;
  webhookUrl: string;
  clientState: string;
}): Promise<{ callControlId: string }> {
  const body: Record<string, unknown> = {
    connection_id: process.env.TELNYX_CONNECTION_ID,
    from: params.from,
    to: params.to,
    webhook_url: params.webhookUrl,
    // Telnyx exige client_state en base64 (error 90017 si no)
    client_state: Buffer.from(params.clientState).toString("base64"),
  };

  let data: { data: TelnyxCallControl };
  try {
    data = await telnyxFetch<{ data: TelnyxCallControl }>("/calls", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (e) {
    // 10010 = la conexión no tiene perfil saliente: asignarlo y reintentar
    if (String((e as Error).message).includes("10010") && body.connection_id) {
      await asegurarPerfilSaliente(String(body.connection_id));
      data = await telnyxFetch<{ data: TelnyxCallControl }>("/calls", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } else {
      throw e;
    }
  }

  logger.info({ from: params.from, to: params.to }, "Llamada saliente creada en Telnyx");
  return { callControlId: data.data.call_control_id };
}

/**
 * Telnyx exige un "outbound voice profile" en la conexión para marcar hacia
 * afuera (error 10010 si falta). Lo crea/asigna automáticamente.
 */
async function asegurarPerfilSaliente(connectionId: string): Promise<void> {
  const conn = await telnyxFetch<{ data: { outbound_voice_profile_id?: string | null } }>(
    `/connections/${connectionId}`
  );
  if (conn.data?.outbound_voice_profile_id) return;

  const perfiles = await telnyxFetch<{ data: Array<{ id: string }> }>(
    "/outbound_voice_profiles"
  );
  let perfilId = perfiles.data?.[0]?.id;
  if (!perfilId) {
    const creado = await telnyxFetch<{ data: { id: string } }>("/outbound_voice_profiles", {
      method: "POST",
      body: JSON.stringify({ name: "VozIA Salientes" }),
    });
    perfilId = creado.data.id;
  }

  await telnyxFetch(`/connections/${connectionId}`, {
    method: "PATCH",
    body: JSON.stringify({ outbound_voice_profile_id: perfilId }),
  });
  logger.info({ connectionId, perfilId }, "Perfil saliente asignado a la conexión");
}

/**
 * Libera (elimina) un número en Telnyx. Desde ese momento Telnyx
 * deja de cobrar la renta mensual del número.
 * DELETE /v2/phone_numbers/{id}
 */
export async function releasePhoneNumber(telnyxPhoneSid: string): Promise<void> {
  await telnyxFetch(`/phone_numbers/${telnyxPhoneSid}`, {
    method: "DELETE",
  });
  logger.info({ telnyxPhoneSid }, "Número liberado en Telnyx");
}

/**
 * Configura webhooks en un número.
 * PATCH /v2/phone_numbers/{id}
 */
export async function configureNumberWebhooks(
  phoneNumberId: string,
  webhookUrl: string,
  failoverUrl?: string
): Promise<TelnyxPhoneNumber> {
  const data = await telnyxFetch<{ data: TelnyxPhoneNumber }>(
    `/phone_numbers/${phoneNumberId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        webhook_url: webhookUrl,
        failover_url: failoverUrl ?? webhookUrl,
        webhook_failover_url: failoverUrl ?? webhookUrl,
      }),
    }
  );

  logger.info({ phoneNumberId, webhookUrl }, "Webhooks configurados en número Telnyx");
  return data.data;
}

/**
 * Configura conexión de voz (connection) para WebSocket streaming.
 * POST /v2/connections
 */
export async function createVoiceConnection(
  name: string,
  webhookUrl: string,
  childAccountId?: string
): Promise<{ id: string; name: string }> {
  const data = await telnyxFetch<{ data: { id: string; name: string } }>(
    "/connections",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        type: "websocket",
        webhook_url: webhookUrl,
        failover_url: webhookUrl,
        account_id: childAccountId,
        anchor_site: "auto", // Selecciona PoP automáticamente
        inbound: {
          channel_limit: 100,
        },
        outbound: {
          channel_limit: 100,
        },
      }),
    }
  );

  logger.info({ connectionId: data.data.id, name }, "Conexión de voz creada");
  return data.data;
}

/**
 * Asigna un número a una conexión.
 * En Telnyx v2 la asignación se hace con PATCH /v2/phone_numbers/{id}
 * pasando connection_id (no existe un endpoint "actions/assign_connection").
 */
export async function assignNumberToConnection(
  phoneNumberId: string,
  connectionId: string
): Promise<void> {
  await telnyxFetch(`/phone_numbers/${phoneNumberId}`, {
    method: "PATCH",
    body: JSON.stringify({ connection_id: connectionId }),
  });

  logger.info({ phoneNumberId, connectionId }, "Número asignado a conexión");
}

/**
 * Busca un número ya comprado en la cuenta (para reintentos tras fallo).
 * GET /v2/phone_numbers?filter[phone_number][]=...
 */
export async function getOwnedNumberByPhone(
  phoneNumber: string
): Promise<TelnyxPhoneNumber | null> {
  try {
    // Telnyx no soporta filtro exacto por número: listar y matchear localmente
    const data = await telnyxFetch<{ data: TelnyxPhoneNumber[] }>(
      `/phone_numbers?page[size]=200`
    );
    return data.data?.find((n) => n.phone_number === phoneNumber) ?? null;
  } catch (e) {
    logger.warn({ error: (e as Error).message, phoneNumber }, "No se pudo consultar número propio");
    return null;
  }
}

/**
 * Genera TeXML para webhook de voz entrante.
 * Usa <Dial><Stream> para streaming bidireccional.
 */
export function generateInboundTeXML(params: {
  streamUrl: string;
  callControlId: string;
  userId: string;
  language?: string;
  voice?: string;
  consentMessage?: string;
  dir?: "inbound" | "outbound";
}): string {
  const { streamUrl, callControlId, userId, language = "es", voice = "neural-es-ES", consentMessage, dir = "inbound" } = params;

  const consentXml = consentMessage
    ? `<Speak voice="${voice}" language="${language}">${escapeXml(consentMessage)}</Speak>`
    : "";

  const dirParam = dir === "outbound" ? "&dir=outbound" : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${consentXml}
  <Dial>
    <Stream
      url="${streamUrl}?user_id=${encodeURIComponent(userId)}&call_control_id=${encodeURIComponent(callControlId)}${dirParam}"
      bidirectional="true"
      audio_track="inbound"
      content_type="audio/x-mulaw;rate=8000"
    />
  </Dial>
</Response>`;
}

/**
 * Genera TeXML para respuesta de estado (ej. saldo insuficiente, mantenimiento).
 */
export function generateRejectionTeXML(message: string, language = "es", voice = "neural-es-ES"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="${voice}" language="${language}">${escapeXml(message)}</Speak>
  <Hangup/>
</Response>`;
}

/**
 * Genera TeXML para transferencia.
 */
export function generateTransferTeXML(transferTo: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Number>${escapeXml(transferTo)}</Number>
  </Dial>
</Response>`;
}

function escapeXml(s: string): string {
  const entities: Record<string, string> = {
    "&": "&",
    "<": "<",
    ">": ">",
    '"': "&",
    "'": "&apos;",
  };
  return s.replace(/[&<>"']/g, (c) => entities[c] ?? c);
}

/**
 * Call Control API - Contesta llamada entrante.
 * POST /v2/calls/{call_control_id}/actions/answer
 */
export async function answerCall(callControlId: string, clientState?: string): Promise<TelnyxCallControl> {
  const data = await telnyxFetch<{ data: TelnyxCallControl }>(
    `/calls/${callControlId}/actions/answer`,
    {
      method: "POST",
      body: JSON.stringify({ client_state: clientState }),
    }
  );
  return data.data;
}



/**
 * Call Control API - Cuelga llamada.
 * POST /v2/calls/{call_control_id}/actions/hangup
 */
export async function hangupCall(callControlId: string): Promise<TelnyxCallControl> {
  const data = await telnyxFetch<{ data: TelnyxCallControl }>(
    `/calls/${callControlId}/actions/hangup`,
    { method: "POST" }
  );
  return data.data;
}

/**
 * Call Control API - Transfiere llamada.
 * POST /v2/calls/{call_control_id}/actions/transfer
 */
export async function transferCall(callControlId: string, destination: string): Promise<TelnyxCallControl> {
  const data = await telnyxFetch<{ data: TelnyxCallControl }>(
    `/calls/${callControlId}/actions/transfer`,
    {
      method: "POST",
      body: JSON.stringify({ destination }),
    }
  );
  return data.data;
}

/**
 * Call Control API - Envía DTMF.
 */
export async function sendDTMF(callControlId: string, digits: string): Promise<TelnyxCallControl> {
  const data = await telnyxFetch<{ data: TelnyxCallControl }>(
    `/calls/${callControlId}/actions/dtmf`,
    {
      method: "POST",
      body: JSON.stringify({ digits }),
    }
  );
  return data.data;
}

/**
 * Call Control API - Inicia grabación.
 * POST /v2/calls/{call_control_id}/actions/record_start
 */
export async function startRecording(callControlId: string, format = "wav"): Promise<{ recording_id: string }> {
  const data = await telnyxFetch<{ data: { recording_id: string } }>(
    `/calls/${callControlId}/actions/record_start`,
    {
      method: "POST",
      body: JSON.stringify({ format }),
    }
  );
  return data.data;
}

/**
 * Call Control API - Detiene grabación.
 */
export async function stopRecording(callControlId: string, recordingId: string): Promise<void> {
  await telnyxFetch(
    `/calls/${callControlId}/actions/record_stop`,
    {
      method: "POST",
      body: JSON.stringify({ recording_id: recordingId }),
    }
  );
}

/**
 * Call Control API - Inicia streaming de audio (Media Forking).
 * POST /v2/calls/{call_control_id}/actions/fork_start
 */
export async function startMediaFork(
  callControlId: string,
  targetUrl: string,
  options?: { audio_format?: string; sample_rate?: number }
): Promise<{ fork_id: string }> {
  const data = await telnyxFetch<{ data: { fork_id: string } }>(
    `/calls/${callControlId}/actions/fork_start`,
    {
      method: "POST",
      body: JSON.stringify({
        target: targetUrl,
        audio_format: options?.audio_format ?? "mulaw",
        sample_rate: options?.sample_rate ?? 8000,
      }),
    }
  );
  return data.data;
}

/**
 * Call Control API - Detiene Media Fork.
 */
export async function stopMediaFork(callControlId: string, forkId: string): Promise<void> {
  await telnyxFetch(
    `/calls/${callControlId}/actions/fork_stop`,
    {
      method: "POST",
      body: JSON.stringify({ fork_id: forkId }),
    }
  );
}

/**
 * Call Control API - Inicia streaming bidireccional (WebSocket).
 * POST /v2/calls/{call_control_id}/actions/streaming_start
 */
export async function startStreaming(
  callControlId: string,
  streamUrl: string,
  clientState?: string
): Promise<void> {
  await telnyxFetch(`/calls/${callControlId}/actions/streaming_start`, {
    method: "POST",
    body: JSON.stringify({
      stream_url: streamUrl,
      stream_track: "both_tracks",
      stream_bidirectional_mode: "rtp",
      stream_bidirectional_codec: "PCMU",
      client_state: clientState,
    }),
  });
}

/**
 * Call Control API - Reproduce audio TTS.
 * POST /v2/calls/{call_control_id}/actions/speak
 */
export async function speakText(
  callControlId: string,
  payload: string,
  language = "es-ES",
  voice = "female"
): Promise<void> {
  await telnyxFetch(`/calls/${callControlId}/actions/speak`, {
    method: "POST",
    body: JSON.stringify({
      payload,
      language,
      voice,
    }),
  });
}

interface TelnyxPhoneNumber {
  id: string;
  phone_number: string;
  country_code: string;
  national_format: string;
  status: string;
  connection_id?: string;
  locality?: string;
  region?: string;
  area_code?: string;
  cost_information?: {
    upfront_cost?: number;
    monthly_cost?: number;
    currency?: string;
  };
}

interface TelnyxCallControl {
  call_control_id: string;
  call_leg_id: string;
  call_session_id: string;
  client_state?: string;
}

interface TelnyxWebhookEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

interface ChildAccount {
  id: string;
  account_name: string;
  email?: string;
}

export interface ChildAccountSetupResult {
  childAccount: ChildAccount;
  apiKey: string;
  connectionId: string;
}



























