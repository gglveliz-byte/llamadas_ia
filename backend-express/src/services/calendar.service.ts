/**
 * Servicio de Citas - CRUD + validación de overlap.
 * Cumple spec sección 9.
 */
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";
import { enviarEmail, emailTemplates } from "./email.service";
import { JsonValue } from "@prisma/client/runtime/library";

export type BusinessHours = Record<
  string,
  { abierto: boolean; inicio: string | null; fin: string | null }
>;

export type ResultadoAgendar =
  | { ok: true; cita: Awaited<ReturnType<typeof db.appointment.create>> }
  | {
      ok: false;
      error:
        | "overlap"
        | "day_closed"
        | "fuera_horario"
        | "duracion_excede"
        | "sin_settings"
        | "no_encontrada";
      detalle?: string;
      conflictoCon?: unknown;
    };

const DIAS_SEMANA: Record<string, string> = {
  domingo: "domingo",
  lunes: "lunes",
  martes: "martes",
  miercoles: "miercoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sabado",
};

/**
 * Devuelve la hora de pared (HH:MM) que corresponde a un instante UTC
 * en la zona horaria del negocio.
 */
function horaEnZona(fecha: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  let h = get("hour");
  if (h === "24") h = "00";
  return `${h}:${get("minute")}`;
}

/**
 * Offset (en minutos) de la zona horaria respecto a UTC para un instante dado.
 */
function offsetMinEnZona(timezone: string, utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utc);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  let h = Number(get("hour"));
  if (h === 24) h = 0;
  const pared = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    h,
    Number(get("minute")),
    Number(get("second"))
  );
  return Math.round((pared - utc.getTime()) / 60000);
}

/**
 * Crea un Date UTC a partir de una fecha "YYYY-MM-DD" y hora "HH:MM"
 * interpretadas como hora de pared en la zona horaria del negocio.
 */
function crearFechaZona(dateStr: string, horaMin: string, timezone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = horaMin.split(":").map(Number);
  const base = Date.UTC(y, m - 1, d, hh, mm);
  let utc = base;
  for (let i = 0; i < 3; i++) {
    const off = offsetMinEnZona(timezone, new Date(utc));
    utc = base - off * 60000;
  }
  return new Date(utc);
}

/**
 * Nombre del día de la semana (sin tildes) para una fecha "YYYY-MM-DD"
 * interpretada en la zona horaria del negocio.
 */
function diaSemanaDeFecha(dateStr: string, timezone: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ref = new Date(Date.UTC(y, m - 1, d, 12));
  const nombre = new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    weekday: "long",
  }).format(ref);
  const normalizado = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return DIAS_SEMANA[normalizado] ?? normalizado;
}

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
): Promise<{ conflicto: boolean; citaExistente?: Awaited<ReturnType<typeof db.appointment.findFirst>> }> {
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
  endTime?: Date;
  durationMinutes?: number;
  recursoId?: string;
  servicio?: string;
  notes?: string;
  extraFields?: Record<string, unknown>;
  phoneNumberId?: number;
}): Promise<ResultadoAgendar> {
  const duracion = params.durationMinutes ?? 30;
  const fin = params.endTime ?? new Date(params.startTime.getTime() + duracion * 60000);

  // Validación server-side contra horario real del negocio
  const settings = await db.businessSettings.findUnique({ where: { userId: params.userId } });
  if (!settings) {
    return { ok: false, error: "sin_settings", detalle: "El negocio no tiene configuración" };
  }
  const timezone = settings.timezone || "America/Mexico_City";
  const horas = (settings.businessHours as BusinessHours) ?? {};
  const diaNombre = diaSemanaDeFecha(
    [
      params.startTime.getUTCFullYear(),
      (params.startTime.getUTCMonth() + 1).toString().padStart(2, "0"),
      params.startTime.getUTCDate().toString().padStart(2, "0"),
    ].join("-"),
    timezone
  );

  const esModo247 = settings.modo247;
  const horarioDia = horas[diaNombre];
  if (!esModo247) {
    if (!horarioDia?.abierto) {
      return { ok: false, error: "day_closed", detalle: `Día ${diaNombre} cerrado` };
    }
    const inicioDia = horaEnZona(params.startTime, timezone);
    const finDia = horaEnZona(fin, timezone);
    if (
      (horarioDia.inicio && inicioDia < horarioDia.inicio) ||
      (horarioDia.fin && finDia > horarioDia.fin)
    ) {
      return {
        ok: false,
        error: "fuera_horario",
        detalle: `Horario de atención ${horarioDia.inicio} - ${horarioDia.fin}`,
      };
    }
  }

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
      error: "overlap",
      conflictoCon: citaExistente,
    };
  }

  const extraFields = params.extraFields ?? {};
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
      servicio: params.servicio,
      notes: params.notes,
      extraFields: extraFields as any,
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

// Enviar emails
  try {
    const user = await db.user.findUnique({ where: { id: params.userId }, select: { businessName: true, email: true } });
    const settings = await db.businessSettings.findUnique({ where: { userId: params.userId } });
    const fechaFormateada = params.startTime.toLocaleString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Email al cliente (si tiene email)
    if (params.customerEmail) {
      const tplCliente = emailTemplates.citaAgendada(
        user?.businessName || "Tu negocio",
        fechaFormateada,
        params.servicio
      );
      await enviarEmail({ to: params.customerEmail, ...tplCliente });
    }

    // Email al dueño del negocio
    if (user?.email) {
      const tplDueno = emailTemplates.nuevaCita(
        params.customerName,
        fechaFormateada,
        params.servicio
      );
      await enviarEmail({ to: user.email, ...tplDueno });
    }
  } catch (e) {
    logger.warn({ error: (e as Error).message, citaId: cita.id }, "Error enviando emails de cita");
  }

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
  date: string, // YYYY-MM-DD (en la zona horaria del negocio)
  recursoId?: string
): Promise<{
  ocupadas: Array<{ startTime: string; endTime: string; customerName: string; recursoId?: string }>;
  disponibles: string[];
  disponibles_iso: string[];
  fecha: string;
  dia: string;
  abierto: boolean;
  horario: string | null;
}> {
  const settings = await db.businessSettings.findUnique({ where: { userId } });
  const timezone = settings?.timezone || "America/Mexico_City";
  const duracionSlot = settings?.defaultDurationMinutes ?? 30;
  const esModo247 = settings?.modo247 ?? false;
  const horas = (settings?.businessHours as BusinessHours) ?? {};
  const dia = diaSemanaDeFecha(date, timezone);
  const horarioDia = horas[dia];

  const abierto = esModo247 || (horarioDia?.abierto ?? false);

  // Limitar la consulta a las citas del día en la zona del negocio
  const inicioDia = crearFechaZona(date, "00:00", timezone);
  const finDia = crearFechaZona(date, "23:59", timezone);

  const where: {
    userId: string;
    status: { not: string };
    startTime: { gte: Date; lte: Date };
    recursoId?: string;
  } = {
    userId,
    status: { not: "cancelado" },
    startTime: { gte: inicioDia, lte: finDia },
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

  // Rango de slots según el horario real del negocio
  let horaInicio = 9;
  let horaFin = 18;
  if (esModo247) {
    horaInicio = 0;
    horaFin = 24;
  } else if (horarioDia?.abierto && horarioDia.inicio && horarioDia.fin) {
    horaInicio = parseInt(horarioDia.inicio.split(":")[0], 10);
    horaFin = parseInt(horarioDia.fin.split(":")[0], 10);
  }

  const disponibles: string[] = [];
  const disponiblesIso: string[] = [];
  if (abierto) {
    for (let h = horaInicio; h < horaFin; h++) {
      for (let m = 0; m < 60; m += duracionSlot) {
        const slot = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        const slotInicio = crearFechaZona(date, slot, timezone);
        const slotFin = new Date(slotInicio.getTime() + duracionSlot * 60000);
        const enConflicto = ocupadas.some((o) => {
          const oi = new Date(o.startTime).getTime();
          const of = new Date(o.endTime).getTime();
          return slotInicio.getTime() < of && slotFin.getTime() > oi;
        });
        if (!enConflicto) {
          disponibles.push(slot);
          disponiblesIso.push(slotInicio.toISOString());
        }
      }
    }
  }

  const horarioTexto = abierto
    ? esModo247
      ? "24 horas"
      : `${horarioDia?.inicio ?? "09:00"} - ${horarioDia?.fin ?? "18:00"}`
    : null;

  return { ocupadas, disponibles, disponibles_iso: disponiblesIso, fecha: date, dia, abierto, horario: horarioTexto };
}
