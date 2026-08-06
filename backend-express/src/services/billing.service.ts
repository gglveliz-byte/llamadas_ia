/**
 * Servicio de Billing - Débito por minuto/segundo, verificación saldo.
 * Cumple spec sección 5.
 */
import { Prisma } from "@prisma/client";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";
import { enviarEmail, emailTemplates } from "./email.service";
import { emitirSSE } from "../sse/events.emitter";

/**
 * Verifica si el usuario tiene saldo suficiente para iniciar una llamada.
 * Cumple spec 5.3 - permite saldo negativo hasta el límite configurado.
 */
export async function verificarSaldo(userId: string): Promise<boolean> {
  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    logger.warn({ userId }, "Wallet no encontrada al verificar saldo");
    return false;
  }

  const limiteNegativo = await getConfig("limite_saldo_negativo");
  const limite = parseFloat(limiteNegativo);

  if (wallet.saldo.toNumber() <= limite) {
    logger.info({ userId, saldo: wallet.saldo.toNumber(), limite }, "Saldo insuficiente - llamada rechazada");
    return false;
  }

  return true;
}

/**
 * Debita el costo de una llamada al finalizar.
 * Cumple spec 5.3 - cobra por minuto completo o por segundo (configurable).
 * Idempotente por callSid: un hangup/stop duplicado no vuelve a cobrar.
 */
export async function debitarLlamada(
  userId: string,
  callSid: string,
  duracionSegundos: number
): Promise<{ monto: number; saldoNuevo: number }> {
  const cobroPorSegundo = (await getConfig("cobro_por_segundo")) === "true";
  const precioMinuto = await getPrecioMinuto(userId);

  let monto: number;
  if (cobroPorSegundo) {
    const precioSegundo = precioMinuto / 60;
    monto = precioSegundo * duracionSegundos;
  } else {
    const minutos = Math.ceil(duracionSegundos / 60);
    monto = precioMinuto * minutos;
  }

  monto = Math.round(monto * 10000) / 10000;

  let resultado: { monto: number; saldoNuevo: number };
  try {
    resultado = await db.$transaction(async (tx) => {
      // Idempotencia: si ya existe débito para este callSid, no volver a cobrar
      const yaDebitado = await tx.walletTransaction.findFirst({
        where: { callSid, tipo: "debito" },
      });
      if (yaDebitado) {
        logger.warn({ callSid }, "Llamada ya debitada - omitiendo cobro duplicado");
        return {
          monto: yaDebitado.monto.toNumber() * -1,
          saldoNuevo: yaDebitado.saldoNuevo.toNumber(),
        };
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        logger.error({ userId }, "Wallet no encontrada al debitar");
        return { monto: 0, saldoNuevo: 0 };
      }

      const saldoAnterior = wallet.saldo.toNumber();
      const saldoNuevo = saldoAnterior - monto;

      await tx.wallet.update({
        where: { userId },
        data: { saldo: saldoNuevo },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          tipo: "debito",
          monto: -monto,
          saldoAnterior,
          saldoNuevo,
          callSid,
          descripcion: `Llamada ${callSid} - ${duracionSegundos}s`,
        },
      });

      logger.info(
        { userId, callSid, duracionSegundos, monto, saldoAnterior, saldoNuevo },
        "Llamada debitada"
      );

      return { monto, saldoNuevo };
    });
  } catch (e) {
    // Carrera: otro request debitó el mismo callSid justo antes
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      logger.warn({ callSid }, "Carrera de débito detectada - omitiendo cobro duplicado");
      const existente = await db.walletTransaction.findFirst({
        where: { callSid, tipo: "debito" },
      });
      return existente
        ? { monto: existente.monto.toNumber() * -1, saldoNuevo: existente.saldoNuevo.toNumber() }
        : { monto: 0, saldoNuevo: 0 };
    }
    throw e;
  }

  // Alertas de saldo bajo (spec 5.4) - fuera de la transacción, no deben romper el cobro
  if (resultado.monto > 0) {
    try {
      await verificarAlertasSaldo(userId, resultado.saldoNuevo, resultado.saldoNuevo + resultado.monto);
    } catch (alertError) {
      logger.error({ error: (alertError as Error).message, userId }, "Error en alerta de saldo");
    }
  }

  return resultado;
}

/**
 * True si tras cobrar `monto` el saldo quedaría por encima del límite negativo.
 */
export async function saldoPermiteCobro(userId: string, monto: number): Promise<boolean> {
  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) return false;
  const limite = parseFloat(await getConfig("limite_saldo_negativo"));
  return wallet.saldo.toNumber() - monto >= limite;
}

/**
 * Debita un concepto genérico (alta de número, renta mensual, etc.).
 * Idempotente por refIdempotencia (misma ref no se cobra dos veces).
 */
export async function debitarConcepto(
  userId: string,
  monto: number,
  descripcion: string,
  refIdempotencia: string
): Promise<{ saldoNuevo: number }> {
  if (monto <= 0) {
    const wallet = await db.wallet.findUnique({ where: { userId } });
    return { saldoNuevo: wallet?.saldo.toNumber() ?? 0 };
  }

  const resultado = await db.$transaction(async (tx) => {
    const yaDebitado = await tx.walletTransaction.findFirst({
      where: { callSid: refIdempotencia, tipo: "debito" },
    });
    if (yaDebitado) {
      logger.warn({ refIdempotencia }, "Concepto ya debitado - omitiendo cobro duplicado");
      return { saldoNuevo: yaDebitado.saldoNuevo.toNumber() };
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet no encontrada");

    const saldoAnterior = wallet.saldo.toNumber();
    const saldoNuevo = saldoAnterior - monto;

    await tx.wallet.update({ where: { userId }, data: { saldo: saldoNuevo } });
    await tx.walletTransaction.create({
      data: {
        userId,
        tipo: "debito",
        monto: -monto,
        saldoAnterior,
        saldoNuevo,
        callSid: refIdempotencia,
        descripcion,
      },
    });
    return { saldoNuevo };
  });

  try {
    await verificarAlertasSaldo(userId, resultado.saldoNuevo, resultado.saldoNuevo + monto);
  } catch (alertError) {
    logger.error({ error: (alertError as Error).message, userId }, "Error en alerta de saldo");
  }

  logger.info({ userId, monto, descripcion, refIdempotencia }, "Concepto debitado");
  return resultado;
}

/**
 * Reversa un cobro de concepto (p.ej. la compra en Telnyx falló tras debitar).
 * Idempotente por refIdempotencia.
 */
export async function reversarConcepto(
  userId: string,
  monto: number,
  descripcion: string,
  refIdempotencia: string
): Promise<void> {
  if (monto <= 0) return;
  await db.$transaction(async (tx) => {
    const yaReversado = await tx.walletTransaction.findFirst({
      where: { callSid: refIdempotencia, tipo: "ajuste_admin" },
    });
    if (yaReversado) return;

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) return;
    const saldoAnterior = wallet.saldo.toNumber();
    const saldoNuevo = saldoAnterior + monto;

    await tx.wallet.update({ where: { userId }, data: { saldo: saldoNuevo } });
    await tx.walletTransaction.create({
      data: {
        userId,
        tipo: "ajuste_admin",
        monto,
        saldoAnterior,
        saldoNuevo,
        callSid: refIdempotencia,
        descripcion,
      },
    });
  });
  logger.info({ userId, monto, refIdempotencia }, "Concepto reversado");
}

/**
 * Acredita saldo tras recarga exitosa de Whop.
 * Cumple spec 5.2. Idempotente por whopPaymentId: un webhook duplicado no acredita doble.
 */
export async function acreditarSaldo(
  userId: string,
  packageId: number,
  whopPaymentId: string,
  amountAfterFees: number
): Promise<{ saldoNuevo: number }> {
  const paquete = await db.rechargePackage.findUnique({ where: { id: packageId } });
  if (!paquete) {
    logger.error({ packageId }, "Paquete no encontrado al acreditar saldo");
    throw new Error("Paquete no encontrado");
  }

  const saldoOtorgado = paquete.saldoOtorgado.toNumber();
  const montoRecarga = paquete.montoRecarga.toNumber();
  const descripcion = `Recarga Paquete ${paquete.nombre} ($${montoRecarga})`;

  try {
    return await db.$transaction(async (tx) => {
      // Idempotencia: si ya se acreditó este whopPaymentId, no volver a acreditar
      const yaRecargado = await tx.walletTransaction.findFirst({
        where: { whopPaymentId, tipo: "recarga" },
      });
      if (yaRecargado) {
        logger.warn({ whopPaymentId }, "Recarga ya procesada - omitiendo crédito duplicado");
        return { saldoNuevo: yaRecargado.saldoNuevo.toNumber() };
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });

      if (!wallet) {
        await tx.wallet.create({ data: { userId, saldo: saldoOtorgado } });
        await tx.walletTransaction.create({
          data: {
            userId,
            tipo: "recarga",
            monto: saldoOtorgado,
            saldoAnterior: 0,
            saldoNuevo: saldoOtorgado,
            whopPaymentId,
            descripcion,
          },
        });
        logger.info({ userId, paquete: paquete.nombre, monto: saldoOtorgado }, "Wallet creada + saldo acreditado");
        return { saldoNuevo: saldoOtorgado };
      }

      const saldoAnterior = wallet.saldo.toNumber();
      const saldoNuevo = saldoAnterior + saldoOtorgado;

      await tx.wallet.update({
        where: { userId },
        data: { saldo: saldoNuevo },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          tipo: "recarga",
          monto: saldoOtorgado,
          saldoAnterior,
          saldoNuevo,
          whopPaymentId,
          descripcion,
        },
      });

      logger.info(
        { userId, paquete: paquete.nombre, monto: saldoOtorgado, whopPaymentId, saldoNuevo },
        "Saldo acreditado tras recarga Whop"
      );

      return { saldoNuevo };
    });
  } catch (e) {
    // Carrera: otro request acreditó el mismo whopPaymentId justo antes
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      logger.warn({ whopPaymentId }, "Carrera de recarga detectada - omitiendo crédito duplicado");
      const existente = await db.walletTransaction.findFirst({
        where: { whopPaymentId, tipo: "recarga" },
      });
      return { saldoNuevo: existente ? existente.saldoNuevo.toNumber() : 0 };
    }
    throw e;
  }
}

/**
 * Reversa saldo tras reembolso de Whop.
 * Idempotente por whopPaymentId: un reembolso duplicado solo revierte una vez.
 */
export async function reversarSaldo(whopPaymentId: string): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      // Idempotencia: si ya se reversó este pago, no volver a hacerlo
      const yaReversado = await tx.walletTransaction.findFirst({
        where: { whopPaymentId, tipo: "ajuste_admin" },
      });
      if (yaReversado) {
        logger.warn({ whopPaymentId }, "Reembolso ya procesado - omitiendo reversa duplicada");
        return;
      }

      const txRecarga = await tx.walletTransaction.findFirst({
        where: { whopPaymentId, tipo: "recarga" },
      });
      if (!txRecarga) {
        logger.warn({ whopPaymentId }, "Transacción de recarga no encontrada para reversar");
        return;
      }

      const wallet = await tx.wallet.findUnique({ where: { userId: txRecarga.userId } });
      if (!wallet) return;

      const saldoAnterior = wallet.saldo.toNumber();
      const montoTx = txRecarga.monto.toNumber();
      const saldoNuevo = saldoAnterior - montoTx;

      await tx.wallet.update({
        where: { userId: txRecarga.userId },
        data: { saldo: saldoNuevo },
      });

      await tx.walletTransaction.create({
        data: {
          userId: txRecarga.userId,
          tipo: "ajuste_admin",
          monto: -montoTx,
          saldoAnterior,
          saldoNuevo,
          whopPaymentId,
          descripcion: `Reembolso Whop ${whopPaymentId}`,
        },
      });

      logger.info({ userId: txRecarga.userId, whopPaymentId, monto: -montoTx }, "Saldo reversado por reembolso");
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      logger.warn({ whopPaymentId }, "Carrera de reversa detectada - omitiendo");
      return;
    }
    throw e;
  }
}

/**
 * Verifica umbrales de saldo bajo y emite alertas.
 * Cumple spec 5.4:
 * - 50% → notificación in-app
 * - 20% → in-app + email
 * - 5%  → in-app + email urgente
 * - $0  → email "saldo agotado"
 */
async function verificarAlertasSaldo(
  userId: string,
  saldoNuevo: number,
  saldoAnterior: number
): Promise<void> {
  const ultimaRecarga = await db.walletTransaction.findFirst({
    where: { userId, tipo: "recarga" },
    orderBy: { createdAt: "desc" },
  });
  if (!ultimaRecarga || ultimaRecarga.monto.toNumber() <= 0) return;

  const montoRecarga = ultimaRecarga.monto.toNumber();
  const pctAnterior = (saldoAnterior / montoRecarga) * 100;
  const pctNuevo = (saldoNuevo / montoRecarga) * 100;

  // Detectar cruces de umbral (bajada)
  const umbrales = [
    { pct: 50, tipo: "saldo_bajo", email: false },
    { pct: 20, tipo: "saldo_bajo", email: true },
    { pct: 5, tipo: "saldo_bajo", email: true, urgente: true },
    { pct: 0, tipo: "saldo_agotado", email: true },
  ];

  for (const u of umbrales) {
    if (pctAnterior > u.pct && pctNuevo <= u.pct) {
      // Cruzó el umbral hacia abajo
      await db.notification.create({
        data: {
          userId,
          tipo: u.tipo,
          titulo: u.tipo === "saldo_agotado" ? "Saldo agotado" : "Saldo bajo",
          mensaje:
            u.tipo === "saldo_agotado"
              ? "Tu saldo se agotó. Recarga para seguir recibiendo llamadas."
              : `Tu saldo está al ${pctNuevo.toFixed(0)}%. Considera recargar.`,
        },
      });
      emitirSSE(userId, "saldo_bajo", { pct: pctNuevo, tipo: u.tipo });
      logger.warn({ userId, pctNuevo, tipo: u.tipo }, "Alerta de saldo bajo emitida");
      if (u.email) {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (user?.email) {
          const template =
            u.tipo === "saldo_agotado"
              ? emailTemplates.saldoAgotado()
              : emailTemplates.saldoBajo(pctNuevo);
          await enviarEmail({ to: user.email, ...template });
        }
      }
    }
  }
}

// Helpers
async function getConfig(clave: string): Promise<string> {
  const config = await db.adminConfig.findUnique({ where: { clave } });
  return config?.valor ?? "0";
}

async function getPrecioMinuto(userId: string): Promise<number> {
  // Buscar la última recarga para obtener el precio/minuto del paquete
  const ultimaRecarga = await db.walletTransaction.findFirst({
    where: { userId, tipo: "recarga" },
    orderBy: { createdAt: "desc" },
  });
  if (ultimaRecarga?.whopPaymentId) {
    // Buscar el paquete por la descripción (en prod se guardaría packageId en metadata)
    const paquetes = await db.rechargePackage.findMany({ where: { activo: true } });
    for (const p of paquetes) {
      if (ultimaRecarga.descripcion?.includes(p.nombre)) {
        return p.precioPorMinuto.toNumber();
      }
    }
  }
  // Fallback al precio default
  return parseFloat(await getConfig("precio_minuto_default"));
}
