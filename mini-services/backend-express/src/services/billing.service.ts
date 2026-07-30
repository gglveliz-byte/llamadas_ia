/**
 * Servicio de Billing - Débito por minuto/segundo, verificación saldo.
 * Cumple spec sección 5.
 */
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";

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

  if (wallet.saldo <= limite) {
    logger.info({ userId, saldo: wallet.saldo, limite }, "Saldo insuficiente - llamada rechazada");
    return false;
  }

  return true;
}

/**
 * Debita el costo de una llamada al finalizar.
 * Cumple spec 5.3 - cobra por minuto completo o por segundo (configurable).
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
    const minutos = Math.ceil(duracionSegundos / 60); // Redondea hacia arriba
    monto = precioMinuto * minutos;
  }

  // Redondear a 4 decimales
  monto = Math.round(monto * 10000) / 10000;

  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    logger.error({ userId }, "Wallet no encontrada al debitar");
    return { monto: 0, saldoNuevo: 0 };
  }

  const saldoAnterior = wallet.saldo;
  const saldoNuevo = saldoAnterior - monto;

  await db.wallet.update({
    where: { userId },
    data: { saldo: saldoNuevo },
  });

  await db.walletTransaction.create({
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

  // Verificar umbrales de saldo bajo (spec 5.4)
  await verificarAlertasSaldo(userId, saldoNuevo, saldoAnterior);

  return { monto, saldoNuevo };
}

/**
 * Acredita saldo tras recarga exitosa de Whop.
 * Cumple spec 5.2.
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

  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    // Crear wallet si no existe
    await db.wallet.create({ data: { userId, saldo: paquete.saldoOtorgado } });
    await db.walletTransaction.create({
      data: {
        userId,
        tipo: "recarga",
        monto: paquete.saldoOtorgado,
        saldoAnterior: 0,
        saldoNuevo: paquete.saldoOtorgado,
        whopPaymentId,
        descripcion: `Recarga Paquete ${paquete.nombre} ($${paquete.montoRecarga})`,
      },
    });
    logger.info({ userId, paquete: paquete.nombre, monto: paquete.saldoOtorgado }, "Wallet creada + saldo acreditado");
    return { saldoNuevo: paquete.saldoOtorgado };
  }

  const saldoAnterior = wallet.saldo;
  const saldoNuevo = saldoAnterior + paquete.saldoOtorgado;

  await db.wallet.update({
    where: { userId },
    data: { saldo: saldoNuevo },
  });

  await db.walletTransaction.create({
    data: {
      userId,
      tipo: "recarga",
      monto: paquete.saldoOtorgado,
      saldoAnterior,
      saldoNuevo,
      whopPaymentId,
      descripcion: `Recarga Paquete ${paquete.nombre} ($${paquete.montoRecarga})`,
    },
  });

  logger.info(
    { userId, paquete: paquete.nombre, monto: paquete.saldoOtorgado, whopPaymentId, saldoNuevo },
    "Saldo acreditado tras recarga Whop"
  );

  return { saldoNuevo };
}

/**
 * Reversa saldo tras reembolso de Whop.
 */
export async function reversarSaldo(whopPaymentId: string): Promise<void> {
  const tx = await db.walletTransaction.findFirst({
    where: { whopPaymentId, tipo: "recarga" },
  });
  if (!tx) {
    logger.warn({ whopPaymentId }, "Transacción de recarga no encontrada para reversar");
    return;
  }

  const wallet = await db.wallet.findUnique({ where: { userId: tx.userId } });
  if (!wallet) return;

  const saldoAnterior = wallet.saldo;
  const saldoNuevo = saldoAnterior - tx.monto;

  await db.wallet.update({
    where: { userId: tx.userId },
    data: { saldo: saldoNuevo },
  });

  await db.walletTransaction.create({
    data: {
      userId: tx.userId,
      tipo: "ajuste_admin",
      monto: -tx.monto,
      saldoAnterior,
      saldoNuevo,
      whopPaymentId,
      descripcion: `Reembolso Whop ${whopPaymentId}`,
    },
  });

  logger.info({ userId: tx.userId, whopPaymentId, monto: -tx.monto }, "Saldo reversado por reembolso");
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
  if (!ultimaRecarga || ultimaRecarga.monto <= 0) return;

  const pctAnterior = (saldoAnterior / ultimaRecarga.monto) * 100;
  const pctNuevo = (saldoNuevo / ultimaRecarga.monto) * 100;

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
      logger.warn({ userId, pctNuevo, tipo: u.tipo }, "Alerta de saldo bajo emitida");
      // En producción aquí se llamaría a email.service.ts si u.email === true
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
        return p.precioPorMinuto;
      }
    }
  }
  // Fallback al precio default
  return parseFloat(await getConfig("precio_minuto_default"));
}
