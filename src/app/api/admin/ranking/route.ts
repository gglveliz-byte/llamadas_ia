import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const clientes = await db.user.findMany({
    where: { role: "cliente" },
    include: {
      wallet: { select: { saldo: true } },
      _count: { select: { metrics: true } },
    },
  });

  const ranking = await Promise.all(
    clientes.map(async (c) => {
      const debitos = await db.walletTransaction.aggregate({
        where: { userId: c.id, tipo: "debito" },
        _sum: { monto: true },
      });
      const recargas = await db.walletTransaction.aggregate({
        where: { userId: c.id, tipo: "recarga" },
        _sum: { monto: true },
      });
      const minutosAgg = await db.callMetric.aggregate({
        where: { userId: c.id },
        _sum: { duracionSegundos: true },
      });
      const fechaPrimeraLlamada = await db.callMetric.findFirst({
        where: { userId: c.id },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const fechaUltimaLlamada = await db.callMetric.findFirst({
        where: { userId: c.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const gastoTotal = Math.abs(debitos._sum.monto?.toNumber() ?? 0);
      const recargaTotal = recargas._sum.monto?.toNumber() ?? 0;
      const minutos = Math.floor((minutosAgg._sum.duracionSegundos ?? 0) / 60);
      const llamadas = c._count.metrics;
      const saldo = c.wallet?.saldo?.toNumber() ?? 0;

      const puntaje = gastoTotal * 2 + minutos * 1.5 + llamadas * 5;

      return {
        userId: c.id,
        email: c.email,
        businessName: c.businessName ?? "Sin nombre",
        isSuspended: c.isSuspended,
        gastoTotal,
        recargaTotal,
        saldo,
        minutos,
        llamadas,
        primeraLlamada: fechaPrimeraLlamada?.createdAt ?? null,
        ultimaLlamada: fechaUltimaLlamada?.createdAt ?? null,
        puntaje,
      };
    })
  );

  ranking.sort((a, b) => b.puntaje - a.puntaje);

  const top10 = ranking.slice(0, 10).map((c, i) => ({
    posicion: i + 1,
    ...c,
  }));

  const resumen = {
    totalClientes: ranking.length,
    clientesActivos: ranking.filter((c) => c.llamadas > 0).length,
    totalMinutos: ranking.reduce((s, c) => s + c.minutos, 0),
    totalGasto: ranking.reduce((s, c) => s + c.gastoTotal, 0),
    totalRecargas: ranking.reduce((s, c) => s + c.recargaTotal, 0),
  };

  return NextResponse.json({ ranking: top10, resumen });
}
