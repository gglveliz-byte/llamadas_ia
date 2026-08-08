"use client";

import * as React from "react";
import { CalendarDays, Plus, Filter, LayoutGrid, CalendarRange, Moon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient, type Appointment } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarView } from "@/components/calendar/CalendarView";
import { NightsView } from "@/components/calendar/NightsView";

const STATUS_COLORS: Record<string, string> = {
  agendado: "bg-emerald-500",
  asistio: "bg-blue-500",
  no_asistio: "bg-red-500",
  cancelado: "bg-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  asistio: "Asistió",
  no_asistio: "No asistió",
  cancelado: "Cancelado",
};

export type VistaCalendario = "lista" | "horas" | "noches";

export function CitasSection() {
  const { usuario } = useAppStore();
  const [citas, setCitas] = React.useState<Appointment[]>([]);
  const [vista, setVista] = React.useState<VistaCalendario>("lista");
  const [mesActual, setMesActual] = React.useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = React.useState<Date | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [filtroEstado, setFiltroEstado] = React.useState<string>("todos");
  const [recursos, setRecursos] = React.useState<Record<string, string>>({});

  const cargarRecursos = React.useCallback(async () => {
    try {
      const data = await ApiClient.get<{
        settings?: { recursos?: Array<{ id: string; nombre: string }> } | null;
      }>("/api/session");
      const mapa: Record<string, string> = {};
      (data.settings?.recursos ?? []).forEach((r) => {
        if (r.id) mapa[r.id] = r.nombre;
      });
      setRecursos(mapa);
    } catch {
      // recursos opcionales
    }
  }, []);

  React.useEffect(() => {
    cargarRecursos();
  }, [cargarRecursos]);

  // Form nueva cita
  const [nuevaOpen, setNuevaOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    duration: "30",
    recursoId: "",
    notes: "",
  });
  const [saving, setSaving] = React.useState(false);

  const cargarCitas = React.useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    const inicio = startOfMonth(mesActual);
    const fin = endOfMonth(mesActual);
    try {
      const data = await ApiClient.get<{ appointments: Appointment[] }>(
        `/api/appointments?userId=${usuario.id}&from=${inicio.toISOString()}&to=${fin.toISOString()}`
      );
      setCitas(data.appointments);
    } finally {
      setLoading(false);
    }
  }, [usuario, mesActual]);

  React.useEffect(() => {
    cargarCitas();
  }, [cargarCitas]);

  const diasMes = React.useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesActual), { weekStartsOn: 1 });
    const fin = endOfWeek(endOfMonth(mesActual), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: inicio, end: fin });
  }, [mesActual]);

  const citasPorDia = (dia: Date) =>
    citas.filter(
      (c) =>
        isSameDay(new Date(c.startTime), dia) &&
        (filtroEstado === "todos" || c.status === filtroEstado)
    );

  const citasDiaSeleccionado = diaSeleccionado
    ? citas
        .filter((c) => isSameDay(new Date(c.startTime), diaSeleccionado))
        .filter((c) => filtroEstado === "todos" || c.status === filtroEstado)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    : [];

  const cambiarEstado = async (id: string, status: string) => {
    try {
      await ApiClient.patch("/api/appointments", { appointmentId: id, status });
      toast.success("Estado actualizado");
      cargarCitas();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const guardarCita = async () => {
    if (!usuario) return;
    setSaving(true);
    try {
      const startTime = new Date(`${form.date}T${form.time}:00`);
      await ApiClient.post("/api/appointments", {
        userId: usuario.id,
        customerName: form.customerName,
        customerPhone: form.customerPhone || undefined,
        customerEmail: form.customerEmail || undefined,
        startTime: startTime.toISOString(),
        durationMinutes: parseInt(form.duration),
        recursoId: form.recursoId || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Cita creada exitosamente");
      setNuevaOpen(false);
      setForm({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        date: format(new Date(), "yyyy-MM-dd"),
        time: "10:00",
        duration: "30",
        recursoId: "",
        notes: "",
      });
      cargarCitas();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMesActual(subMonths(mesActual, 1))}>
            <span className="text-lg">←</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setMesActual(addMonths(mesActual, 1))}>
            <span className="text-lg">→</span>
          </Button>
          <h2 className="text-lg font-semibold capitalize ml-2">
            {format(mesActual, "MMMM yyyy", { locale: es })}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => { setMesActual(new Date()); setDiaSeleccionado(new Date()); }}>
            Hoy
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-40 h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="asistio">Asistió</SelectItem>
              <SelectItem value="no_asistio">No asistió</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={nuevaOpen} onOpenChange={setNuevaOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                Nueva cita
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Agendar nueva cita</DialogTitle>
                <DialogDescription>
                  Completa los datos del cliente. El sistema validará conflictos de horario.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="customerName">Nombre del cliente *</Label>
                  <Input
                    id="customerName"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    placeholder="María González"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      placeholder="+52 55 1234 5678"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Correo</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.customerEmail}
                      onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                      placeholder="cliente@email.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="date">Fecha</Label>
                    <Input
                      id="date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="time">Hora</Label>
                    <Input
                      id="time"
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duration">Duración (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notas</Label>
                  <Input
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Notas adicionales"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNuevaOpen(false)}>Cancelar</Button>
                <Button onClick={guardarCita} disabled={saving || !form.customerName}>
                  {saving ? "Guardando..." : "Guardar cita"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setVista("lista")}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", vista === "lista" ? "bg-background shadow-sm" : "hover:bg-muted")}
        >
          <LayoutGrid className="h-3.5 w-3.5 inline mr-1" />
          Lista
        </button>
        <button
          onClick={() => setVista("horas")}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", vista === "horas" ? "bg-background shadow-sm" : "hover:bg-muted")}
        >
          <CalendarRange className="h-3.5 w-3.5 inline mr-1" />
          Horas
        </button>
        <button
          onClick={() => setVista("noches")}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", vista === "noches" ? "bg-background shadow-sm" : "hover:bg-muted")}
        >
          <Moon className="h-3.5 w-3.5 inline mr-1" />
          Noches
        </button>
      </div>

      {vista === "horas" ? (
        <Card className="panel-wa">
          <CardContent className="p-4">
            <CalendarView appointments={citas} />
          </CardContent>
        </Card>
      ) : vista === "noches" ? (
        <Card className="panel-wa">
          <CardContent className="p-4">
            <NightsView appointments={citas} recursos={recursos} />
          </CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendario */}
        <Card className="panel-wa lg:col-span-2">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {diasMes.map((dia) => {
                const enMes = isSameMonth(dia, mesActual);
                const hoy = isSameDay(dia, new Date());
                const citasDia = citasPorDia(dia);
                const seleccionado = diaSeleccionado && isSameDay(dia, diaSeleccionado);
                return (
                  <button
                    key={dia.toISOString()}
                    onClick={() => setDiaSeleccionado(dia)}
                    className={cn(
                      "min-h-20 p-1.5 rounded-lg border text-left transition-colors",
                      !enMes && "opacity-40",
                      seleccionado
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                      hoy && !seleccionado && "ring-1 ring-primary"
                    )}
                  >
                    <div className={cn(
                      "text-xs font-semibold mb-1",
                      hoy && "text-primary"
                    )}>
                      {format(dia, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {citasDia.slice(0, 3).map((c) => (
                        <div
                          key={c.id}
                          className={cn(
                            "h-1.5 rounded-full",
                            STATUS_COLORS[c.status]
                          )}
                          title={`${c.customerName} · ${format(new Date(c.startTime), "HH:mm")}`}
                        />
                      ))}
                      {citasDia.length > 3 && (
                        <div className="text-[9px] text-muted-foreground">
                          +{citasDia.length - 3} más
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista de citas del día */}
        <Card className="panel-wa">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {diaSeleccionado
                ? format(diaSeleccionado, "EEEE d 'de' MMM", { locale: es })
                : "Selecciona un día"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[28rem]">
              {citasDiaSeleccionado.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No hay citas este día
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {citasDiaSeleccionado.map((cita) => (
                    <div key={cita.id} className="p-3 space-y-2 hover:bg-muted/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {cita.customerName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(cita.startTime), "HH:mm")}
                            {cita.durationMinutes && ` · ${cita.durationMinutes}min`}
                            {cita.recursoId && ` · ${recursos[cita.recursoId] || "Recurso"}`}
                          </div>
                          {cita.servicio && (
                            <div className="text-xs font-medium text-primary mt-0.5">
                              {cita.servicio}
                            </div>
                          )}
                          {cita.customerPhone && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {cita.customerPhone}
                            </div>
                          )}
                          {cita.notes && (
                            <div className="text-xs italic text-muted-foreground mt-1">
                              "{cita.notes}"
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] flex-shrink-0"
                          style={{
                            borderColor: STATUS_COLORS[cita.status].replace("bg-", "").includes("500")
                              ? STATUS_COLORS[cita.status]
                              : undefined,
                          }}
                        >
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full mr-1", STATUS_COLORS[cita.status])}
                          />
                          {STATUS_LABEL[cita.status]}
                        </Badge>
                      </div>
                      <Select
                        value={cita.status}
                        onValueChange={(v) => cambiarEstado(cita.id, v)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Cambiar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agendado">Agendado</SelectItem>
                          <SelectItem value="asistio">Asistió</SelectItem>
                          <SelectItem value="no_asistio">No asistió</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
