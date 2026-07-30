/**
 * Webhooks de Twilio.
 * Cumple spec sección 7.1.
 */
import { Router } from "express";
import { db } from "../models/database.pool";
import { validarFirmaTwilio } from "../middleware/twilioSignature";
import { verificarSaldo } from "../services/billing.service";
import { logger } from "../utils/logger";

export const twilioRouter = Router();

/**
 * POST /webhooks/twilio/voice
 * Webhook de llamada entrante.
 * Cumple spec 7.1.
 */
twilioRouter.post("/voice", validarFirmaTwilio, async (req, res) => {
  const { CallSid, From, To } = req.body;

  logger.info({ CallSid, From, To }, "Llamada entrante de Twilio");

  // Buscar usuario por número
  const phone = await db.phoneNumber.findFirst({
    where: { phoneNumber: To, isActive: true },
    include: { user: true },
  });

  if (!phone?.user) {
    logger.warn({ To }, "Número no registrado");
    return res.type("text/xml").send(
      `<Response><Say language="es">Lo sentimos, este número no está configurado.</Say><Hangup/></Response>`
    );
  }

  const userId = phone.user.id;

  // 1. Verificar mantenimiento global
  const mantenimiento = await db.adminConfig.findUnique({
    where: { clave: "mensaje_mantenimiento" },
  });
  if (mantenimiento?.valor) {
    return res.type("text/xml").send(
      `<Response><Say language="es">${escapeXml(mantenamiento.valor)}</Say><Hangup/></Response>`
    );
  }

  // 2. Verificar saldo
  const saldoOk = await verificarSaldo(userId);
  if (!saldoOk) {
    return res.type("text/xml").send(
      `<Response><Say language="es">Lo sentimos, este servicio no está disponible temporalmente.</Say><Hangup/></Response>`
    );
  }

  // 3. Verificar suspención
  if (phone.user.isSuspended) {
    return res.type("text/xml").send(
      `<Response><Say language="es">Esta cuenta está suspendida.</Say><Hangup/></Response>`
    );
  }

  // 4. Verificar horario de atención
  const settings = await db.businessSettings.findUnique({ where: { userId } });
  if (!settings) {
    return res.type("text/xml").send(
      `<Response><Say language="es">Configuración no encontrada.</Say><Hangup/></Response>`
    );
  }

  const dentroDeHorario = verificarHorario(settings);
  if (!dentroDeHorario && !settings.modo247) {
    const horarioTexto = formatearHorarioTts(settings);
    return res.type("text/xml").send(
      `<Response><Say language="${settings.aiLanguage}">Gracias por llamar. Nuestro horario de atención es ${escapeXml(horarioTexto)}.</Say><Hangup/></Response>`
    );
  }

  // 5. Conectar stream bidireccional
  const wsHost = process.env.DOMINIO_EXPRESS?.replace(/^https?:\/\//, "") || "localhost:3001";
  const wsUrl = `wss://${wsHost}/stream/twilio?user_id=${userId}&call_sid=${CallSid}`;

  const consentimiento =
    settings.consentimientoActivo && settings.mensajeConsentimiento
      ? `<Say language="${settings.aiLanguage}">${escapeXml(settings.mensajeConsentimiento)}</Say>`
      : "";

  const twiml = `<Response>
    ${consentimiento}
    <Connect>
      <Stream url="${wsUrl}" />
    </Connect>
  </Response>`;

  logger.info({ CallSid, wsUrl }, "TwiML enviado - conectando stream");

  // Registrar inicio de llamada para métricas
  await db.callMetric.create({
    data: {
      callSid: CallSid,
      userId,
      inicio: new Date(),
    },
  }).catch(() => {});

  return res.type("text/xml").send(twiml);
});

/**
 * POST /webhooks/twilio/status
 * Status callback de llamadas.
 */
twilioRouter.post("/status", validarFirmaTwilio, async (req, res) => {
  const { CallSid, CallStatus, CallDuration, ErrorCode } = req.body;
  logger.info({ CallSid, CallStatus, CallDuration, ErrorCode }, "Status callback Twilio");

  if (ErrorCode) {
    // Loggear errores conocidos (spec 17.19)
    const errores: Record<string, string> = {
      "31924": "Error de protocolo WebSocket",
      "31903": "Broken pipe",
      "31931": "Buffer overflow",
    };
    logger.error(
      { CallSid, ErrorCode, descripcion: errores[ErrorCode] || "Error desconocido" },
      "Error de Twilio"
    );

    await db.callMetric.updateMany({
      where: { callSid: CallSid },
      data: { errorCode: ErrorCode },
    }).catch(() => {});
  }

  res.status(200).send("OK");
});

function verificarHorario(settings: { businessHours: string; timezone: string }): boolean {
  try {
    const horario = JSON.parse(settings.businessHours) as Record<
      string,
      { abierto: boolean; inicio: string | null; fin: string | null }
    >;
    const ahora = new Date();
    // Convertir a la zona horaria del negocio (simplificado)
    const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const diaActual = dias[ahora.getDay()];
    const horarioHoy = horario[diaActual];
    if (!horarioHoy?.abierto) return false;

    const horaActual = ahora.getHours() * 100 + ahora.getMinutes();
    const inicio = parseInt((horarioHoy.inicio || "00:00").replace(":", ""));
    const fin = parseInt((horarioHoy.fin || "23:59").replace(":", ""));
    return horaActual >= inicio && horaActual <= fin;
  } catch {
    return true; // Si hay error, permitir la llamada
  }
}

function formatearHorarioTts(settings: { businessHours: string }): string {
  try {
    const horario = JSON.parse(settings.businessHours) as Record<
      string,
      { abierto: boolean; inicio: string | null; fin: string | null }
    >;
    const partes: string[] = [];
    const dias: Record<string, string> = {
      lunes: "lunes",
      martes: "martes",
      miercoles: "miércoles",
      jueves: "jueves",
      viernes: "viernes",
      sabado: "sábados",
      domingo: "domingos",
    };
    for (const [key, label] of Object.entries(dias)) {
      const h = horario[key];
      if (h?.abierto) {
        partes.push(`${label} de ${h.inicio} a ${h.fin}`);
      }
    }
    return partes.join(", ");
  } catch {
    return "horario no disponible";
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
