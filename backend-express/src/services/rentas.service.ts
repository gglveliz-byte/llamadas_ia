/**
 * Facturación de rentas mensuales de números telefónicos.
 * Cobra el monthlyCost de cada número activo cada 30 días desde
 * lastMonthlyChargeAt (o purchasedAt).
 *
 * Ciclo de impago:
 *  1) Renta vencida sin saldo → el número se SUSPENDE (suspensionAt).
 *  2) Si pasa `dias_gracia_liberacion` sin pagar → se LIBERA en Telnyx
 *     (releasedAt): Telnyx deja de cobrarle la renta al dueño del SaaS.
 *  3) Si paga dentro de la gracia → se reactiva al cobrar.
 *  Los números liberados NO se reactivan: el cliente compra uno nuevo.
 */
import { db } from "../models/database.pool";
import { debitarConcepto, saldoPermiteCobro } from "./billing.service";
import { releasePhoneNumber } from "./telnyx.service";
import { emitirSSE } from "../sse/events.emitter";
import { enviarEmail, emailTemplates } from "./email.service";
import { logger } from "../utils/logger";

const DIA_MS = 24 * 60 * 60 * 1000;
const PERIODO_MS = 30 * DIA_MS;

function periodoDe(base: number): string {
  return new Date(base).toISOString().slice(0, 7);
}

async function getDiasGracia(): Promise<number> {
  const cfg = await db.adminConfig.findUnique({ where: { clave: "dias_gracia_liberacion" } });
  const dias = parseInt(cfg?.valor ?? "5", 10);
  return isNaN(dias) ? 5 : dias;
}

async function notificar(
  userId: string,
  tipoSSE: string,
  tipoNotif: string,
  titulo: string,
  mensaje: string,
  email?: { subject: string; text: string; html?: string }
): Promise<void> {
  emitirSSE(userId, tipoSSE, { mensaje });
  await db.notification
    .create({ data: { userId, tipo: tipoNotif, titulo, mensaje } })
    .catch((e) => logger.warn({ error: (e as Error).message }, "No se pudo crear notificación"));
  if (email) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      await enviarEmail({ to: user.email, ...email }).catch((e) =>
        logger.warn({ error: (e as Error).message }, "No se pudo enviar email")
      );
    }
  }
}

/**
 * Procesa rentas vencidas, suspensiones, liberaciones y reactivaciones
 * de un solo usuario. Se llama desde el job global y tras cada recarga.
 */
export async function procesarRentasUsuario(userId: string): Promise<void> {
  const ahora = Date.now();
  const diasGracia = await getDiasGracia();

  // 1) ACTIVOS con renta vencida → cobrar o suspender
  const activos = await db.phoneNumber.findMany({
    where: { userId, isActive: true, monthlyCost: { gt: 0 }, releasedAt: null },
  });

  for (const n of activos) {
    const base = (n.lastMonthlyChargeAt ?? n.purchasedAt).getTime();
    if (ahora - base < PERIODO_MS) continue;

    const mensual = n.monthlyCost!.toNumber();
    const ref = `renta_num_${n.id}_${periodoDe(base)}`;

    try {
      if (await saldoPermiteCobro(userId, mensual)) {
        await debitarConcepto(userId, mensual, `Renta mensual ${n.phoneNumber}`, ref);
        await db.phoneNumber.update({
          where: { id: n.id },
          data: { lastMonthlyChargeAt: new Date(), suspensionAt: null },
        });
      } else {
        const fechaLimite = new Date(ahora + diasGracia * DIA_MS);
        await db.phoneNumber.update({
          where: { id: n.id },
          data: { isActive: false, suspensionAt: new Date() },
        });
        const mensaje = `Tu número ${n.phoneNumber} fue suspendido por saldo insuficiente ($${mensual.toFixed(2)} de renta). Si no recargas antes del ${fechaLimite.toLocaleDateString("es-MX")}, el número se liberará y deberás comprar uno nuevo.`;
        await notificar(
          userId,
          "numero_suspendido",
          "numero_suspendido",
          "Número suspendido",
          mensaje,
          emailTemplates.numeroSuspendido(n.phoneNumber, mensual.toFixed(2), fechaLimite.toLocaleDateString("es-MX"))
        );
        logger.warn({ userId, phoneNumber: n.phoneNumber, fechaLimite }, "Número suspendido por renta impagada");
      }
    } catch (e) {
      logger.error({ error: (e as Error).message, phoneNumber: n.phoneNumber }, "Error procesando renta mensual");
    }
  }

  // 2) SUSPENDIDOS en gracia → reactivar si el saldo ya alcanza
  const suspendidos = await db.phoneNumber.findMany({
    where: { userId, isActive: false, releasedAt: null, monthlyCost: { gt: 0 }, suspensionAt: { not: null } },
  });

  for (const n of suspendidos) {
    const base = (n.lastMonthlyChargeAt ?? n.purchasedAt).getTime();
    if (ahora - base < PERIODO_MS) continue;

    const mensual = n.monthlyCost!.toNumber();
    const ref = `renta_num_${n.id}_${periodoDe(base)}`;

    try {
      if (await saldoPermiteCobro(userId, mensual)) {
        await debitarConcepto(userId, mensual, `Renta mensual ${n.phoneNumber} (reactivación)`, ref);
        await db.phoneNumber.update({
          where: { id: n.id },
          data: { isActive: true, lastMonthlyChargeAt: new Date(), suspensionAt: null },
        });
        emitirSSE(userId, "numero_reactivado", { phoneNumber: n.phoneNumber });
        logger.info({ userId, phoneNumber: n.phoneNumber }, "Número reactivado tras cobrar renta");
      }
    } catch (e) {
      logger.error({ error: (e as Error).message, phoneNumber: n.phoneNumber }, "Error reactivando número");
    }
  }

  // 3) SUSPENDIDOS que agotaron la gracia → LIBERAR en Telnyx
  const porLiberar = await db.phoneNumber.findMany({
    where: {
      userId,
      releasedAt: null,
      isActive: false,
      suspensionAt: { not: null, lte: new Date(ahora - diasGracia * DIA_MS) },
    },
  });

  for (const n of porLiberar) {
    try {
      if (n.telnyxPhoneSid) {
        await releasePhoneNumber(n.telnyxPhoneSid);
      }
      await db.phoneNumber.update({ where: { id: n.id }, data: { releasedAt: new Date() } });
      const mensaje = `Tu número ${n.phoneNumber} fue liberado por renta impagada. Telnyx ya no lo factura. Cuando recargues podrás comprar un número nuevo.`;
      await notificar(
        userId,
        "numero_liberado",
        "numero_liberado",
        "Número liberado",
        mensaje,
        emailTemplates.numeroLiberado(n.phoneNumber)
      );
      logger.warn({ userId, phoneNumber: n.phoneNumber }, "Número liberado en Telnyx por renta impagada");
    } catch (e) {
      logger.error({ error: (e as Error).message, phoneNumber: n.phoneNumber }, "Error liberando número en Telnyx");
    }
  }
}

export async function procesarRentasMensuales(): Promise<void> {
  const userIds = await db.phoneNumber.findMany({
    where: { monthlyCost: { gt: 0 }, releasedAt: null },
    select: { userId: true },
    distinct: ["userId"],
  });

  let procesados = 0;
  for (const u of userIds) {
    await procesarRentasUsuario(u.userId);
    procesados++;
  }
  if (procesados > 0) {
    logger.info({ usuarios: procesados }, "Rentas mensuales procesadas");
  }
}
