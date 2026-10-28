/**
 * Servicio de Billing - Débito por minuto/segundo, verificación saldo.
 * Cumple spec sección 5.
 */
import { Prisma } from "@prisma/client";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";
import { enviarEmail, emailTemplates } from "./email.service";
import { emitirSSE } from "../sse/events.emitter";

import { calcularComisiones, aplicarComisiones } from "./commission.service";

/**
 * Verifica si el cliente final tiene saldo suficiente (prepago) o depósito (retención).
 */
export async function verificarSaldo(tenantId: string, endCustomerPhone: string): Promise<{ saldoOk: boolean; maxSegundos: number }> {
  // Limpieza defensiva: remover sufijo SIP URI si llegara sin limpiar
  const telefonoLimpio = endCustomerPhone.split("@")[0];
  const endCustomer = await db.endCustomer.findUnique({
    where: { tenantId_telefono: { tenantId, telefono: telefonoLimpio } }
  });

  const tenantSettings = await db.businessSettings.findUnique({ where: { userId: tenantId } });
  const precioMinuto = tenantSettings?.precioPorMinuto.toNumber() || 0.50;

  let maxSegundos = 0;

  if (endCustomer) {
    // Tiene minutos prepagados?
    if (endCustomer.saldoMinutos.toNumber() > 0) {
      maxSegundos += Math.floor(endCustomer.saldoMinutos.toNumber() * 60);
    }

    // Tiene depósito de retención de dinero? (Solo consideramos saldo > 0 ya que EndCustomer no puede ir a negativo en débito)
    if (endCustomer.saldoDinero.toNumber() > 0) {
      maxSegundos += Math.floor((endCustomer.saldoDinero.toNumber() / precioMinuto) * 60);
    }
  }

  // Si el cliente final tiene saldo prepago para al menos 1 minuto (60 segundos)
  if (maxSegundos >= 60) {
    // Telnyx max limit is 14400 (4 hours)
    return { saldoOk: true, maxSegundos: Math.min(maxSegundos, 14400) };
  }

  // MODO DEMO LIBRE:
  // Si el llamante no tiene saldo prepagado o no está registrado, permitimos la llamada si la cuenta
  // del negocio (Tenant Wallet) tiene saldo disponible para financiar la demo.
  const tenantWallet = await db.wallet.findUnique({ where: { userId: tenantId } });
  const saldoTenant = tenantWallet?.saldo.toNumber() ?? 0;
  const adminConfig = await db.adminConfig.findUnique({ where: { clave: "precio_minuto_minimo" } });
  const precioPiso = parseFloat(adminConfig?.valor || "0.50");

  if (saldoTenant >= precioPiso) {
    // Auto-registrar al llamante como prospecto en EndCustomer si no existe
    if (!endCustomer) {
      await db.endCustomer.create({
        data: {
          tenantId,
          telefono: telefonoLimpio,
          nombre: `Llamante Demo ${telefonoLimpio.slice(-4)}`,
        }
      }).catch(() => {});
    }

    // Límite generoso de hasta 10 minutos (600s) por llamada demo para proteger el saldo
    const segundosPermitidos = Math.min(Math.floor((saldoTenant / precioPiso) * 60), 600);
    logger.info({ tenantId, endCustomerPhone: telefonoLimpio, saldoTenant, segundosPermitidos }, "🟢 Llamada demo libre autorizada con saldo de la cuenta");
    return { saldoOk: true, maxSegundos: Math.max(segundosPermitidos, 60) };
  }

  logger.info({ endCustomerPhone, saldoMinutos: endCustomer?.saldoMinutos?.toNumber() ?? 0, saldoDinero: endCustomer?.saldoDinero?.toNumber() ?? 0, saldoTenant }, "Saldo insuficiente tanto en cliente como en cuenta - llamada rechazada");
  return { saldoOk: false, maxSegundos: 0 };
}

/**
 * Debita el costo de una llamada al finalizar al Cliente Final.
 */
export async function debitarLlamada(
  tenantId: string,
  endCustomerPhone: string,
  callSid: string,
  duracionSegundos: number
): Promise<{ monto: number; saldoNuevo: number }> {
  // Limpieza defensiva: remover sufijo SIP URI si llegara sin limpiar
  const telefonoLimpio = endCustomerPhone.split("@")[0];
  
  const endCustomer = await db.endCustomer.findUnique({
    where: { tenantId_telefono: { tenantId, telefono: telefonoLimpio } }
  });

  const tenantSettings = await db.businessSettings.findUnique({ where: { userId: tenantId } });
  const precioMinuto = tenantSettings?.precioPorMinuto.toNumber() || 0.50;
  const cobroPorSegundo = (await getConfig("cobro_por_segundo")) === "true";
  
  let minutosConsumidos = cobroPorSegundo ? duracionSegundos / 60 : Math.ceil(duracionSegundos / 60);
  const monto = Math.round(precioMinuto * minutosConsumidos * 10000) / 10000;

  // Si no hay endCustomer o el endCustomer no tiene saldo prepago ni depósito, debitamos de la Wallet del Dueño (llamada demo)
  if (!endCustomer || (endCustomer.saldoMinutos.toNumber() <= 0 && endCustomer.saldoDinero.toNumber() <= 0)) {
    const lock = await db.callMetric.updateMany({
      where: { callSid: callSid, fin: null },
      data: { fin: new Date() }
    });
    if (lock.count === 0) {
      const wallet = await db.wallet.findUnique({ where: { userId: tenantId } });
      return { monto: 0, saldoNuevo: wallet?.saldo.toNumber() ?? 0 };
    }

    const res = await debitarConcepto(
      tenantId,
      monto,
      `Llamada Demo Entrante de ${telefonoLimpio}`,
      callSid
    );
    return { monto, saldoNuevo: res.saldoNuevo };
  }

  let resultado: { monto: number; saldoNuevo: number };
  try {
    resultado = await db.$transaction(async (tx) => {
      // Idempotencia Atómica: Intentamos actualizar `fin`. Si ya no estaba null, updateMany devuelve count 0.
      const updateResult = await tx.callMetric.updateMany({
        where: { callSid: callSid, fin: null },
        data: { fin: new Date() }
      });

      if (updateResult.count === 0) {
        logger.warn({ callSid }, "debitarLlamada: llamada ya cobrada (o no existe) - omitiendo débito duplicado por race condition");
        const txEnd = await tx.endCustomer.findUnique({ where: { id: endCustomer.id } });
        return { monto: 0, saldoNuevo: txEnd?.saldoMinutos.toNumber() ?? 0 };
      }

      const txEnd = await tx.endCustomer.findUnique({ where: { id: endCustomer.id } });
      if (!txEnd) return { monto: 0, saldoNuevo: 0 };

      let saldoMinutosNuevo = txEnd.saldoMinutos.toNumber();
      let saldoDineroNuevo = txEnd.saldoDinero.toNumber();
      
      if (saldoMinutosNuevo > 0) {
        // Debitar de prepago
        const minutosRestar = Math.min(minutosConsumidos, saldoMinutosNuevo);
        saldoMinutosNuevo -= minutosRestar;
        minutosConsumidos -= minutosRestar;
        // Si aún sobran minutos consumidos (se acabó el saldo prepago a mitad de la llamada), se debita del dinero si hay.
      }

      let minutosDeRetencionConsumidos = 0;

      if (minutosConsumidos > 0 && saldoDineroNuevo > 0) {
        // Debitar de dinero (retención) — limitar al saldo disponible para evitar negativo
        const costoTotal = minutosConsumidos * precioMinuto;
        const costoReal = Math.min(costoTotal, saldoDineroNuevo);
        saldoDineroNuevo -= costoReal;
        // Calcular minutos proporcionales al monto realmente cobrado
        minutosDeRetencionConsumidos = costoReal / precioMinuto;
      }

      await tx.endCustomer.update({
        where: { id: endCustomer.id },
        data: { 
          saldoMinutos: saldoMinutosNuevo,
          saldoDinero: Math.max(0, Math.round(saldoDineroNuevo * 10000) / 10000)
        }
      });

      // Repartir comisiones para los minutos cobrados por retención
      if (minutosDeRetencionConsumidos > 0) {
        const montoRetencion = minutosDeRetencionConsumidos * precioMinuto;
        const comisiones = await calcularComisiones(tenantId, montoRetencion, minutosDeRetencionConsumidos);
        await aplicarComisiones(
          tx,
          tenantId,
          comisiones.affiliateId,
          comisiones.comisionDueno,
          comisiones.comisionAfiliado,
          callSid
        );
      }

      // No estamos guardando en WalletTransaction porque EndCustomer usa otra estructura.
      // Sería ideal tener un historial, pero actualizamos los saldos.
      
      return { monto, saldoNuevo: saldoMinutosNuevo }; // Simplificado para devolver saldo minutos
    });
  } catch (e) {
    throw e;
  }

  return resultado;
}

/**
 * True si el Cliente Final tiene suficiente retención para un cobro posterior.
 */
export async function saldoPermiteCobroEndCustomer(tenantId: string, endCustomerPhone: string, monto: number): Promise<boolean> {
  const endCustomer = await db.endCustomer.findUnique({
    where: { tenantId_telefono: { tenantId, telefono: endCustomerPhone } }
  });
  if (!endCustomer) return false;
  const limite = parseFloat(await getConfig("limite_saldo_negativo"));
  return endCustomer.saldoDinero.toNumber() - monto >= limite;
}

/**
 * True si tras cobrar `monto` el saldo (Ganancias) del Dueño quedaría por encima del límite.
 * Usado para cobrar Rentas de Números Telefónicos.
 */
export async function saldoPermiteCobro(userId: string, monto: number): Promise<{ saldoOk: boolean; maxSegundos: number }> {
  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) return { saldoOk: false, maxSegundos: 0 };
  const limite = parseFloat(await getConfig("limite_saldo_negativo"));
  
  const saldoDisponible = wallet.saldo.toNumber() - limite;
  if (saldoDisponible < monto) return { saldoOk: false, maxSegundos: 0 };

  const adminConfig = await db.adminConfig.findUnique({ where: { clave: "precio_minuto_minimo" } });
  const precioPiso = parseFloat(adminConfig?.valor || "0.50");

  const maxSegundos = Math.floor((saldoDisponible / precioPiso) * 60);
  
  // Requiere al menos 1 minuto de saldo
  if (maxSegundos >= 60) {
    return { saldoOk: true, maxSegundos: Math.min(maxSegundos, 14400) };
  }
  
  return { saldoOk: false, maxSegundos: 0 };
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
  // Ya no usamos rechargePackage de Prisma. Se usa el precio default.
  return parseFloat(await getConfig("precio_minuto_default"));
}
