import { Prisma } from "@prisma/client";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";

/**
 * Calcula y reparte las comisiones de un pago de un cliente final.
 * 
 * @param tenantId ID del dueño del negocio
 * @param montoTotal Monto total pagado por el cliente final
 * @param minutosComprados Minutos que compró el cliente (en prepago) o consumió (en retención)
 * @returns El desglose de comisiones
 */
export async function calcularComisiones(
  tenantId: string,
  montoTotal: number,
  minutosComprados: number
): Promise<{
  comisionPlataforma: number;
  comisionDueno: number;
  comisionAfiliado: number;
  affiliateId: string | null;
}> {
  const adminConfig = await db.adminConfig.findUnique({ where: { clave: "precio_minuto_minimo" } });
  const precioPisoStr = adminConfig?.valor || "0.50";
  const precioPiso = parseFloat(precioPisoStr);

  const tenant = await db.user.findUnique({
    where: { id: tenantId },
    include: {
      settings: true,
      affiliate: true,
    }
  });

  if (!tenant) {
    throw new Error("Dueño de negocio no encontrado");
  }

  const precioDueno = tenant.settings?.precioPorMinuto?.toNumber() || precioPiso;
  
  // 1. Margen bruto del Dueño (markup total)
  const diferenciaPorMinuto = Math.max(0, precioDueno - precioPiso);
  
  // RevShare: La plataforma cobra un porcentaje (20%) sobre el margen del dueño
  const adminConfigRevShare = await db.adminConfig.findUnique({ where: { clave: "porcentaje_revshare" } });
  const revSharePorcentaje = parseFloat(adminConfigRevShare?.valor || "0.20");
  
  const cortePlataformaPorMinuto = diferenciaPorMinuto * revSharePorcentaje;
  const gananciaNetaDuenoPorMinuto = diferenciaPorMinuto - cortePlataformaPorMinuto;
  
  const comisionDueno = gananciaNetaDuenoPorMinuto * minutosComprados;

  // 2. Comisión del Afiliado y Plataforma
  let comisionAfiliado = 0;
  let comisionPlataforma = 0;
  let affiliateId = tenant.affiliateId;

  if (tenant.affiliate && tenant.affiliate.isActive) {
    const comisionFijaPorMinuto = tenant.affiliate.comisionPorMinuto.toNumber();
    
    // Comisión del afiliado es fija por cada minuto hablado
    comisionAfiliado = comisionFijaPorMinuto * minutosComprados;

    // Protección: La comisión del afiliado no puede superar el piso de la plataforma,
    // de lo contrario la plataforma perdería dinero por minuto.
    const maxComisionPosible = precioPiso * minutosComprados;
    if (comisionAfiliado > maxComisionPosible) {
        comisionAfiliado = maxComisionPosible;
    }
  } else {
    affiliateId = null;
  }

  // La plataforma se queda con el resto del monto total, menos lo del dueño y lo del afiliado.
  // Matemáticamente esto incluye el costo base (precioPiso) + la ganancia extra de RevShare.
  comisionPlataforma = montoTotal - comisionDueno - comisionAfiliado;

  // Redondear a 4 decimales
  const round = (n: number) => Math.round(n * 10000) / 10000;

  return {
    comisionPlataforma: round(comisionPlataforma),
    comisionDueno: round(comisionDueno),
    comisionAfiliado: round(comisionAfiliado),
    affiliateId
  };
}

/**
 * Aplica las comisiones calculadas a los saldos (wallets) de cada parte.
 */
export async function aplicarComisiones(
  tx: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  tenantId: string,
  affiliateId: string | null,
  comisionDueno: number,
  comisionAfiliado: number,
  referencia: string
): Promise<void> {
  
  // Sumar ganancia al Dueño del Negocio (su Wallet ahora es de ganancias)
  if (comisionDueno > 0) {
    let walletDueno = await tx.wallet.findUnique({ where: { userId: tenantId } });
    if (!walletDueno) {
      walletDueno = await tx.wallet.create({ data: { userId: tenantId, saldo: 0 } });
    }
    
    const saldoAnterior = walletDueno.saldo.toNumber();
    const saldoNuevo = saldoAnterior + comisionDueno;
    
    await tx.wallet.update({
      where: { userId: tenantId },
      data: { saldo: saldoNuevo }
    });

    await tx.walletTransaction.create({
      data: {
        userId: tenantId,
        tipo: "ganancia_cliente",
        monto: comisionDueno,
        saldoAnterior,
        saldoNuevo,
        descripcion: `Ganancia por cliente final (${referencia})`,
        whopPaymentId: referencia
      }
    });
  }

  // Sumar ganancia al Afiliado
  if (affiliateId && comisionAfiliado > 0) {
    const afiliado = await tx.affiliate.findUnique({ where: { id: affiliateId } });
    if (afiliado) {
      await tx.affiliate.update({
        where: { id: affiliateId },
        data: {
          saldoAcumulado: afiliado.saldoAcumulado.toNumber() + comisionAfiliado,
          totalGanado: afiliado.totalGanado.toNumber() + comisionAfiliado
        }
      });
    }
  }
}
