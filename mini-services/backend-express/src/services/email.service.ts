/**
 * Servicio de Email - Nodemailer con Gmail App Password.
 * Cumple spec sección 12.2.
 *
 * En sandbox: si no hay SMTP configurado, loggea el email en vez de enviarlo.
 */
import nodemailer from "nodemailer";
import { logger } from "../utils/logger";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function enviarEmail(params: EmailParams): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.warn(
      { to: params.to, subject: params.subject },
      "[SMTP no configurado] Email simulado:"
    );
    logger.info({ text: params.text.slice(0, 200) }, "Contenido del email:");
    return false;
  }

  try {
    await t.sendMail({
      from: `"VozIA" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    logger.info({ to: params.to, subject: params.subject }, "Email enviado");
    return true;
  } catch (e) {
    logger.error({ error: (e as Error).message, to: params.to }, "Error enviando email");
    return false;
  }
}

/**
 * Plantillas de email predefinidas.
 * Cumple spec 12.2 - tabla de eventos.
 */
export const emailTemplates = {
  registro: (token: string) => ({
    subject: "Verifica tu cuenta - VozIA",
    text: `Bienvenido a VozIA. Verifica tu cuenta con este enlace: ${process.env.DOMINIO_FRONTEND}/verify?token=${token}`,
  }),
  recuperacion: (token: string) => ({
    subject: "Restablece tu contraseña - VozIA",
    text: `Restablece tu contraseña: ${process.env.DOMINIO_FRONTEND}/reset?token=${token}`,
  }),
  citaAgendada: (negocio: string, fecha: string) => ({
    subject: `Confirmación de cita - ${negocio}`,
    text: `Tu cita ha sido agendada para ${fecha}. Te esperamos.`,
  }),
  nuevaCita: (cliente: string, fecha: string) => ({
    subject: "Tienes una nueva cita",
    text: `Nueva cita agendada por ${cliente} para ${fecha}.`,
  }),
  saldoBajo: (porcentaje: number) => ({
    subject: "Tu saldo está por agotarse",
    text: `Tu saldo está al ${porcentaje}%. Considera recargar para seguir recibiendo llamadas.`,
  }),
  saldoAgotado: () => ({
    subject: "Saldo agotado - Recarga para seguir",
    text: "Tu saldo se agotó. Recarga para seguir recibiendo llamadas.",
  }),
  alertaSistema: (mensaje: string) => ({
    subject: "⚠️ Alerta de rendimiento - VozIA",
    text: mensaje,
  }),
};
