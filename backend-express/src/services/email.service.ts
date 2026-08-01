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

export async function verificarSMTP(): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    logger.info("SMTP configurado y operativo");
    return true;
  } catch (e) {
    logger.error({ error: (e as Error).message }, "SMTP configurado pero no pudo conectar");
    return false;
  }
}

export async function enviarEmail(params: EmailParams): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      logger.error(
        { to: params.to, subject: params.subject },
        "SMTP no configurado - email NO enviado"
      );
    } else {
      logger.warn(
        { to: params.to, subject: params.subject },
        "[SMTP no configurado] Email simulado:"
      );
      logger.info({ text: params.text.slice(0, 200) }, "Contenido del email:");
    }
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

function baseHtml(content: string): string {
  const frontendUrl = process.env.DOMINIO_FRONTEND || "http://localhost:3000";
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VozIA</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <tr>
      <td style="background:#1a1a2e;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">VozIA</h1>
        <p style="margin:8px 0 0;color:#a0a0c0;font-size:14px;">Asistente de voz con IA</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 24px;color:#333;line-height:1.6;font-size:16px;">
        ${content}
      </td>
    </tr>
    <tr>
      <td style="background:#f8f9fa;padding:24px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;color:#888;font-size:12px;">© 2024 VozIA. Todos los derechos reservados.</p>
        <p style="margin:8px 0 0;color:#aaa;font-size:11px;">Si no solicitaste este email, ignóralo.</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buttonHtml(url: string, text: string, color: string = "#1a1a2e"): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
  <tr>
    <td style="border-radius:6px;background:${color};" bgcolor="${color}">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;color:#fff;text-decoration:none;border-radius:6px;">
        ${text}
      </a>
    </td>
  </tr>
</table>
  `.trim();
}

/**
 * Plantillas de email predefinidas con HTML.
 * Cumple spec 12.2 - tabla de eventos.
 */
export const emailTemplates = {
  registro: (token: string) => {
    const url = `${process.env.DOMINIO_FRONTEND}/verify?token=${token}`;
    return {
      subject: "Verifica tu cuenta - VozIA",
      text: `Bienvenido a VozIA.\n\nVerifica tu cuenta con este enlace:\n${url}\n\nSi no creaste esta cuenta, ignora este mensaje.`,
      html: baseHtml(`
        <h2 style="margin:0 0 16px;color:#1a1a2e;">¡Bienvenido a VozIA!</h2>
        <p>Gracias por registrarte. Para activar tu cuenta, verifica tu email haciendo clic en el botón:</p>
        ${buttonHtml(url, "Verificar mi cuenta")}
        <p style="margin:24px 0 0;font-size:14px;color:#888;">O copia este enlace en tu navegador:<br><a href="${url}" style="color:#666;word-break:break-all;">${url}</a></p>
        <p style="margin:24px 0 0;font-size:14px;color:#888;">Si no creaste esta cuenta, ignora este mensaje.</p>
      `),
    };
  },
  recuperacion: (token: string) => {
    const url = `${process.env.DOMINIO_FRONTEND}/reset?token=${token}`;
    return {
      subject: "Restablece tu contraseña - VozIA",
      text: `Restablece tu contraseña: ${url}\n\nEste enlace expira en 1 hora.\nSi no solicitaste esto, ignora este mensaje.`,
      html: baseHtml(`
        <h2 style="margin:0 0 16px;color:#1a1a2e;">Restablecer contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para crear una nueva:</p>
        ${buttonHtml(url, "Restablecer contraseña", "#dc2626")}
        <p style="margin:24px 0 0;font-size:14px;color:#888;">Este enlace expira en <strong>1 hora</strong>.</p>
        <p style="margin:24px 0 0;font-size:14px;color:#888;">Si no solicitaste esto, ignora este mensaje.</p>
      `),
    };
  },
  citaAgendada: (negocio: string, fecha: string) => ({
    subject: `Confirmación de cita - ${negocio}`,
    text: `Tu cita ha sido agendada para ${fecha}. Te esperamos.`,
    html: baseHtml(`
      <h2 style="margin:0 0 16px;color:#1a1a2e;">Cita confirmada</h2>
      <p>Tu cita en <strong>${negocio}</strong> ha sido agendada para:</p>
      <p style="font-size:18px;font-weight:600;color:#1a1a2e;margin:16px 0;">${fecha}</p>
      <p>Te esperamos. Si necesitas cambiarla, contáctanos.</p>
    `),
  }),
  nuevaCita: (cliente: string, fecha: string) => ({
    subject: "Tienes una nueva cita",
    text: `Nueva cita agendada por ${cliente} para ${fecha}.`,
    html: baseHtml(`
      <h2 style="margin:0 0 16px;color:#1a1a2e;">Nueva cita agendada</h2>
      <p><strong>${cliente}</strong> ha agendado una cita para:</p>
      <p style="font-size:18px;font-weight:600;color:#1a1a2e;margin:16px 0;">${fecha}</p>
      <p>Revisa tu panel para ver los detalles.</p>
    `),
  }),
  saldoBajo: (porcentaje: number) => ({
    subject: "Tu saldo está por agotarse",
    text: `Tu saldo está al ${porcentaje}%. Considera recargar para seguir recibiendo llamadas.`,
    html: baseHtml(`
      <h2 style="margin:0 0 16px;color:#1a1a2e;">Saldo bajo</h2>
      <p>Tu saldo ha bajado al <strong>${porcentaje}%</strong> de tu última recarga.</p>
      <p>Considera recargar para seguir recibiendo llamadas sin interrupciones.</p>
      ${buttonHtml(`${process.env.DOMINIO_FRONTEND}/dashboard?tab=recargas`, "Recargar ahora", "#f59e0b")}
    `),
  }),
  saldoAgotado: () => ({
    subject: "Saldo agotado - Recarga para seguir",
    text: "Tu saldo se agotó. Recarga para seguir recibiendo llamadas.",
    html: baseHtml(`
      <h2 style="margin:0 0 16px;color:#dc2626;">Saldo agotado</h2>
      <p>Tu saldo ha llegado a <strong>$0.00</strong>. Las llamadas entrantes serán rechazadas hasta que recargues.</p>
      ${buttonHtml(`${process.env.DOMINIO_FRONTEND}/dashboard?tab=recargas`, "Recargar ahora", "#dc2626")}
    `),
  }),
  alertaSistema: (mensaje: string) => ({
    subject: "⚠️ Alerta de rendimiento - VozIA",
    text: mensaje,
    html: baseHtml(`
      <h2 style="margin:0 0 16px;color:#dc2626;">⚠️ Alerta del sistema</h2>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;color:#991b1b;font-family:monospace;font-size:13px;white-space:pre-wrap;">${mensaje}</div>
    `),
  }),
};

export type EmailTemplateKey = keyof typeof emailTemplates;