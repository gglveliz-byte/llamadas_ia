"use client";

import * as React from "react";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/api";

const locales = { es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const STATUS_COLORS: Record<string, string> = {
  agendado: "#10b981",
  asistio: "#3b82f6",
  no_asistio: "#ef4444",
  cancelado: "#94a3b8",
};

interface CalendarViewProps {
  appointments: Appointment[];
  onSelectEvent?: (appointment: Appointment) => void;
}

export function CalendarView({ appointments, onSelectEvent }: CalendarViewProps) {
  const events: Event[] = appointments
    .filter((a) => a.status !== "cancelado")
    .map((a) => ({
      title: a.customerName,
      start: new Date(a.startTime),
      end: a.endTime ? new Date(a.endTime) : new Date(new Date(a.startTime).getTime() + (a.durationMinutes ?? 30) * 60000),
      resource: a,
    }));

  return (
    <div className="h-[600px]">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture="es"
        defaultView="month"
        views={["month", "week", "day"]}
        eventPropGetter={(event) => {
          const a = event.resource as Appointment;
          return {
            style: {
              backgroundColor: STATUS_COLORS[a.status] ?? "#10b981",
              borderRadius: "4px",
              border: "none",
              fontSize: "12px",
            },
          };
        }}
        onSelectEvent={(event) => onSelectEvent?.(event.resource as Appointment)}
        popup
      />
    </div>
  );
}
