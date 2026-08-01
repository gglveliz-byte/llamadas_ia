import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminClientActionSchema, adminAdjustBalanceSchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";

/**
 * GET /api/admin/clients
 * Lista todos los clientes con su saldo, consumo y métricas agregadas.
 */
export async function GET() {
  const clientes = await db.user.findMany({
    where: { role: "cliente" },
    include: {
      wallet: true,
      settings: { select: { aiLanguage: true, timezone: true } },
      _count: {
        select: {
          appointments: true,
          metrics: true,
          phoneNumbers: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Calcular consumo total por cliente
  const clientesConConsumo = await Promise.all(
    clientes.map(async (c) => {
      const debitos = await db.walletTransaction.aggregate({
        where: { userId: c.id, tipo: "debito" },
        _sum: { monto: true },
      });
      const recargas = await db.walletTransaction.aggregate({
        where: { userId: c.id, tipo: "recarga" },
        _sum: { monto: true },
      });
      const minutosLlamada = await db.callMetric.aggregate({
        where: { userId: c.id },
        _sum: { duracionSegundos: true },
      });
      return {
        id: c.id,
        email: c.email,
        businessName: c.businessName ?? "Sin nombre",
        isSuspended: c.isSuspended,
        isVerified: c.isVerified,
        createdAt: c.createdAt,
        saldo: c.wallet?.saldo?.toNumber() ?? 0,
        totalDebitado: Math.abs(debitos._sum.monto?.toNumber() ?? 0),
        totalRecargado: recargas._sum.monto?.toNumber() ?? 0,
        minutosLlamada: Math.floor((minutosLlamada._sum.duracionSegundos ?? 0) / 60),
        totalLlamadas: c._count.metrics,
        totalCitas: c._count.appointments,
        totalNumeros: c._count.phoneNumbers,
        aiLanguage: c.settings?.aiLanguage ?? "es",
        timezone: c.settings?.timezone ?? "America/Mexico_City",
      };
    })
  );

  return NextResponse.json({ clientes: clientesConConsumo });
}

/**
 * PATCH /api/admin/clients
 * Suspender / activar / eliminar un cliente.
 * Body: { clientId, action: 'suspend' | 'activate' | 'delete' }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const val = validate(adminClientActionSchema, body);
  if (val.error) return val.error;
  const { clientId, action } = val.data!;

  if (action === "suspend") {
    await db.user.update({ where: { id: clientId }, data: { isSuspended: true } });
  } else if (action === "activate") {
    await db.user.update({ where: { id: clientId }, data: { isSuspended: false } });
  } else if (action === "delete") {
    await db.user.delete({ where: { id: clientId } });
  } else {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/admin/clients/adjust-balance
 * Ajuste manual de saldo (admin).
 * Body: { clientId, monto, descripcion }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const val = validate(adminAdjustBalanceSchema, body);
  if (val.error) return val.error;
  const { clientId, monto, descripcion } = val.data!;

  const wallet = await db.wallet.findUnique({ where: { userId: clientId } });
  if (!wallet) return NextResponse.json({ error: "Wallet no encontrada" }, { status: 404 });

  const saldoAnterior = wallet.saldo.toNumber();
  const saldoNuevo = saldoAnterior + monto;

  await db.wallet.update({
    where: { userId: clientId },
    data: { saldo: saldoNuevo },
  });

  await db.walletTransaction.create({
    data: {
      userId: clientId,
      tipo: "ajuste_admin",
      monto,
      saldoAnterior,
      saldoNuevo,
      descripcion: descripcion || `Ajuste manual del admin`,
    },
  });

  return NextResponse.json({ ok: true, saldoNuevo });
}
