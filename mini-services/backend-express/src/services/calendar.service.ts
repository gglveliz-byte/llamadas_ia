/**
 * Servicio de Citas - CRUD + validación de overlap.
 * Cumple spec sección 9.
 */
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";

/**
 * Verifica si hay overlap con otra cita existente.
 * Cumple spec 9.2.
 * Retorna true si HAY conflicto.
 */
export async function verificarOverlap(
  userId: string,
  startTime: Date,
  endTime: Date,
  recursoId?: string
): Promise<{ conflicto: boolean; citaExistente?: typeof db.appointment }> {
  const where: {
    userId: string;
    status: { not: string };
    startTime: { lt: Date };
    endTime: { gt: Date };
    recursoId?: string;
  } = {
    userId,
    status: { not: "cancelado" },
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };

  if (recursoId) {
    where.recursoId = recursoId;
  }

  const conflicto = await db.appointment.findFirst({ where });
  return {
    conflicto: !!conflicto,
    citaExistente: conflicto ?? undefined,
  };
}

/**
 * Crea una nueva cita con validación previa de overlap.
 */
export async function agendarCita(params: {
  userId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  startTime: Date;
  durationMinutes?: number;
  recursoId?: string;
  notes?: string;
  extraFields?: Record<string, unknown>;
  phoneNumberId?: number;
}): Promise<{ ok: true; cita: Awaited<ReturnType<typeof db.appointment.create>> } | { ok: false; error: string; conflictoCon?: unknown }> {
  const duracion = params.durationMinutes ?? 30;
  const fin = new Date(params.startTime.getTime() + duracion * 60000);

  const { conflicto, citaExistente } = await verificarOverlap(
    params.userId,
    params.startTime,
    fin,
    params.recursoId
  );

  if (conflicto) {
    logger.warn({ userId: params.userId, conflicto: citaExistente }, "Conflicto al agendar cita");
    return {
      ok: false,
      error: "Conflicto de horario",
      conflictoCon: citaExistente,
    };
  }

  const cita = await db.appointment.create({
    data: {
      userId: params.userId,
      phoneNumberId: params.phoneNumberId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      startTime: params.startTime,
      endTime: fin,
      durationMinutes: duracion,
      recursoId: params.recursoId,
      notes: params.notes,
      extraFields: params.extraFields ? JSON.stringify(params.extraFields) : null,
    },
  });

  logger.info({ citaId: cita.id, userId: params.userId }, "Cita agendada");

  // Crear notificación
  await db.notification.create({
    data: {
      userId: params.userId,
      tipo: "nueva_cita",
      titulo: "Nueva cita agendada",
      mensaje: `${params.customerName} - ${params.startTime.toLocaleString("es-MX")}`,
    },
  });

  return { ok: true, cita };
}

/**
 * Cancela una cita por nombre o teléfono del cliente.
 * Cumple spec 7.6 - tool `cancelar_cita`.
 */
export async function cancelarCita(params: {
  userId: string;
  customerName?: string;
  customerPhone?: string;
  date?: string; // YYYY-MM-DD aproximado
}): Promise<{ canceladas: number }> {
  const where: {
    userId: string;
    status: string;
    customerName?: { contains: string };
    customerPhone?: { contains: string };
  } = {
    userId: params.userId,
    status: "agendado",
  };

  if (params.customerName) {
    where.customerName = { contains: params.customerName };
  }
  if (params.customerPhone) {
    where.customerPhone = { contains: params.customerPhone };
  }

  const citas = await db.appointment.findMany({ where });
  if (citas.length === 0) return { canceladas: 0 };

  // Si se especifica fecha, filtrar por la más cercana
  let aCancelar = citas;
  if (params.date) {
    const fecha = new Date(params.date);
    aCancelar = citas.sort(
      (a, b) =>
        Math.abs(a.startTime.getTime() - fecha.getTime()) -
        Math.abs(b.startTime.getTime() - fecha.getTime())
    );
    aCancelar = aCancelar.slice(0, 1); // Solo la más cercana
  }

  for (const cita of aCancelar) {
    await db.appointment.update({
      where: { id: cita.id },
      data: { status: "cancelado" },
    });
  }

  logger.info({ userId: params.userId, canceladas: aCancelar.length }, "Citas canceladas");
  return { canceladas: aCancelar.length };
}

/**
 * Consulta disponibilidad para una fecha.
 * Cumple spec 7.6 - tool `consultar_disponibilidad`.
 */
export async function consultarDisponibilidad(
  userId: string,
  date: string, // YYYY-MM-DD
  recursoId?: string
): Promise<{
  ocupadas: Array<{ startTime: string; endTime: string; customerName: string; recursoId?: string }>;
  disponibles: string[];
}> {
  const inicio = new Date(date + "T00:00:00");
  const fin = new Date(date + "T23:59:59");

  const where: {
    userId: string;
    status: { not: string };
    startTime: { gte: Date; lte: Date };
    recursoId?: string;
  } = {
    userId,
    status: { not: "cancelado" },
    startTime: { gte: inicio, lte: fin },
  };

  if (recursoId) where.recursoId = recursoId;

  const citas = await db.appointment.findMany({
    where,
    orderBy: { startTime: "asc" },
  });

  const ocupadas = citas.map((c) => ({
    startTime: c.startTime.toISOString(),
    endTime: c.endTime?.toISOString() ?? "",
    customerName: c.customerName,
    recursoId: c.recursoId ?? undefined,
  }));

  // Generar slots disponibles (9:00 - 18:00, cada 30 min)
  const disponibles: string[] = [];
  const settings = await db.businessSettings.findUnique({ where: { userId } });
  const duracionSlot = settings?.defaultDurationMinutes ?? 30;
  for (let h = 9; h < 18; h++) {
    for (let m = 0; m < 60; m += duracionSlot) {
      const slot = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const slotInicio = new Date(date + "T" + slot + ":00");
      const slotFin = new Date(slotInicio.getTime() + duracionSlot * 60000);
      const enConflicto = ocupadas.some((o) => {
        const oi = new Date(o.startTime).getTime();
        const of = new Date(o.endTime).getTime();
        return slotInicio.getTime() < of && slotFin.getTime() > oi;
      });
      if (!enConflicto) disponibles.push(slot);
    }
  }

  return { ocupadas, disponibles };
}
