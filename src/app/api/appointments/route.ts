import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAppointmentSchema, updateAppointmentSchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";

/**
 * GET /api/appointments?userId=...&from=...&to=...
 * Lista citas del usuario en un rango de fechas (default: mes actual).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: { userId: string; startTime?: { gte?: Date; lte?: Date } } = { userId };
  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from);
    if (to) where.startTime.lte = new Date(to);
  }

  const appointments = await db.appointment.findMany({
    where,
    orderBy: { startTime: "asc" },
    take: 200,
    include: { phoneNumber: true },
  });

  return NextResponse.json({ appointments });
}

/**
 * POST /api/appointments
 * Crea una nueva cita. Valida overlap antes de insertar.
 * Body: { userId, customerName, customerPhone, customerEmail, startTime, durationMinutes, recursoId, notes }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const val = validate(createAppointmentSchema, body);
  if (val.error) return val.error;
  const {
    userId,
    customerName,
    customerPhone,
    customerEmail,
    startTime,
    durationMinutes = 30,
    recursoId,
    servicio,
    notes,
    extraFields,
  } = val.data!;

  const inicio = new Date(startTime);
  const fin = new Date(inicio.getTime() + durationMinutes * 60000);

  // Validar overlap (spec 9.2)
  const overlapQuery: { userId: string; status: { not: string }; startTime: { lt: Date }; endTime?: { gt: Date }; recursoId?: string } = {
    userId,
    status: { not: "cancelado" },
    startTime: { lt: fin },
  };
  if (recursoId) {
    overlapQuery.endTime = { gt: inicio };
    overlapQuery.recursoId = recursoId;
  } else {
    overlapQuery.endTime = { gt: inicio };
  }

  const conflicto = await db.appointment.findFirst({ where: overlapQuery });
  if (conflicto) {
    return NextResponse.json(
      { error: "Conflicto de horario", conflictoCon: conflicto },
      { status: 409 }
    );
  }

  // Buscar phone number del usuario
  const phone = await db.phoneNumber.findFirst({ where: { userId } });

  const cita = await db.appointment.create({
    data: {
      userId,
      phoneNumberId: phone?.id,
      customerName,
      customerPhone,
      customerEmail,
      startTime: inicio,
      endTime: fin,
      durationMinutes,
      recursoId,
      servicio: servicio || null,
      notes,
      extraFields: (extraFields ?? null) as never,
    },
  });

  // Crear notificación
  await db.notification.create({
    data: {
      userId,
      tipo: "nueva_cita",
      titulo: "Nueva cita agendada",
      mensaje: `${customerName} agendó para ${inicio.toLocaleString("es-MX")}`,
    },
  });

  return NextResponse.json({ cita });
}

/**
 * PATCH /api/appointments
 * Actualiza el estado de una cita.
 * Body: { appointmentId, status }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const val = validate(updateAppointmentSchema, body);
  if (val.error) return val.error;
  const { appointmentId, status } = val.data!;

  const cita = await db.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });

  return NextResponse.json({ cita });
}
