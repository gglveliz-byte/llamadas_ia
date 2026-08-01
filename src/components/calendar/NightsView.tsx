"use client";

import * as React from "react";
import { DateRange, type Range } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/api";
import { format, isWithinInterval } from "date-fns";

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  asistio: "Asistió",
  no_asistio: "No asistió",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  agendado: "text-emerald-600 dark:text-emerald-400",
  asistio: "text-blue-600 dark:text-blue-400",
  no_asistio: "text-red-600 dark:text-red-400",
  cancelado: "text-slate-400",
};

interface NightsViewProps {
  appointments: Appointment[];
  onDateChange?: (range: { start: Date; end: Date }) => void;
  recursos?: Record<string, string>;
}

export function NightsView({ appointments, onDateChange, recursos = {} }: NightsViewProps) {
  const [state, setState] = React.useState<Range[]>([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  const handleChange = (ranges: Record<string, Range>) => {
    const sel = ranges.selection;
    setState([sel]);
    if (sel.startDate && sel.endDate) {
      onDateChange?.({ start: sel.startDate, end: sel.endDate });
    }
  };

  const citasEnRango = appointments.filter((a) => {
    if (!state[0].startDate || !state[0].endDate) return false;
    const inicio = new Date(a.startTime);
    return isWithinInterval(inicio, {
      start: state[0].startDate,
      end: state[0].endDate,
    });
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex justify-center">
        <DateRange
          ranges={state}
          onChange={handleChange}
          locale={es}
          moveRangeOnFirstSelection={false}
          months={2}
          direction="horizontal"
          rangeColors={["#10b981"]}
        />
      </div>
      <div className="space-y-2">
        {citasEnRango.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No hay reservas en este rango
          </div>
        ) : (
          citasEnRango.map((a) => (
            <div
              key={a.id}
              className="p-3 rounded-lg border border-border hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{a.customerName}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(a.startTime), "d MMM yyyy", { locale: es })}
                  </div>
                  {a.recursoId && (
                    <div className="text-xs text-muted-foreground">
                      {recursos[a.recursoId] || "Recurso"}
                    </div>
                  )}
                </div>
                <span className={cn("text-xs font-medium", STATUS_COLORS[a.status])}>
                  {STATUS_LABEL[a.status]}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
