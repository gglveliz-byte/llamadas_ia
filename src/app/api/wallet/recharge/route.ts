import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/wallet/recharge
 * Simula el webhook de Whop tras pago exitoso.
 * Body: { userId, packageId, whopPaymentId, amountAfterFees }
 *
 * En producción, este endpoint sería llamado por el webhook de Whop,
 * no por el frontend. Aquí lo exponemos para fines demo.
 */
export async function POST(req: NextRequest) {
  const { userId, packageId, whopPaymentId } = await req.json();

  const paquete = await db.rechargePackage.findUnique({ where: { id: parseInt(packageId) } });
  if (!paquete) return NextResponse.json({ error: "Paquete no encontrado" }, { status: 404 });

  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) return NextResponse.json({ error: "Wallet no encontrada" }, { status: 404 });

  const saldoAnterior = wallet.saldo;
  const saldoNuevo = saldoAnterior + paquete.saldoOtorgado;

  // 1. Actualizar wallet
  await db.wallet.update({
    where: { userId },
    data: { saldo: saldoNuevo },
  });

  // 2. Registrar transacción
  const tx = await db.walletTransaction.create({
    data: {
      userId,
      tipo: "recarga",
      monto: paquete.saldoOtorgado,
      saldoAnterior,
      saldoNuevo,
      whopPaymentId: whopPaymentId || "whop_demo_" + Date.now(),
      descripcion: `Recarga Paquete ${paquete.nombre} ($${paquete.montoRecarga})`,
    },
  });

  // 3. Crear notificación in-app
  await db.notification.create({
    data: {
      userId,
      tipo: "nueva_cita",
      titulo: "Recarga exitosa",
      mensaje: `Se agregaron $${paquete.saldoOtorgado.toFixed(2)} a tu saldo.`,
    },
  });

  return NextResponse.json({ ok: true, transaction: tx, saldoNuevo });
}
