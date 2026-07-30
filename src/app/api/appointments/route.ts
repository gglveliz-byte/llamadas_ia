import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
  const {
    userId,
    customerName,
    customerPhone,
    customerEmail,
    startTime,
    durationMinutes = 30,
    recursoId,
    notes,
    extraFields,
  } = body;

  if (!userId || !customerName || !startTime) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

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
      notes,
      extraFields: extraFields ? JSON.stringify(extraFields) : null,
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
  const { appointmentId, status } = await req.json();
  if (!appointmentId || !status) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const cita = await db.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });

  return NextResponse.json({ cita });
}
