"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  PhoneCall,
  CalendarClock,
  DollarSign,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient, type Appointment, type WalletTransaction } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MetricasUsuario {
  totalCitas: number;
  citasHoy: number;
  citasProximas: Appointment[];
  totalLlamadas: number;
  minutosLlamada: number;
  gastoHoy: number;
  llamadasUltimos7Dias: Array<{ dia: string; llamadas: number; minutos: number; costo: number }>;
  estadoCitas: Array<{ estado: string; cantidad: number }>;
  transacciones: WalletTransaction[];
}

const STATUS_COLORS: Record<string, string> = {
  agendado: "#10b981",
  asistio: "#3b82f6",
  no_asistio: "#ef4444",
  cancelado: "#94a3b8",
};

export function DashboardSection() {
  const { usuario } = useAppStore();
  const [data, setData] = React.useState<MetricasUsuario | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!usuario) return;
    setLoading(true);
    Promise.all([
      ApiClient.get<{ appointments: Appointment[] }>(
        `/api/appointments?userId=${usuario.id}`
      ),
      ApiClient.get<{ transactions: WalletTransaction[] }>(
        `/api/wallet/transactions?userId=${usuario.id}&limit=10`
      ),
    ])
      .then(([apptData, txData]) => {
        const ahora = new Date();
        const inicioHoy = new Date();
        inicioHoy.setHours(0, 0, 0, 0);
        const en7dias = new Date(ahora.getTime() + 7 * 86400000);

        const citasHoy = apptData.appointments.filter(
          (a) => new Date(a.startTime) >= inicioHoy && new Date(a.startTime) <= ahora
        ).length;

        const citasProximas = apptData.appointments
          .filter((a) => new Date(a.startTime) >= ahora && a.status === "agendado")
          .slice(0, 5);

        // Llamadas últimos 7 días (simulado a partir de transacciones débito)
        const debitos = txData.transactions.filter((t) => t.tipo === "debito");
        const dias = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(ahora);
          d.setDate(d.getDate() - (6 - i));
          d.setHours(0, 0, 0, 0);
          const fin = new Date(d);
          fin.setHours(23, 59, 59, 999);
          const txsDia = debitos.filter((t) => {
            const td = new Date(t.createdAt);
            return td >= d && td <= fin;
          });
          return {
            dia: format(d, "EEE", { locale: es }),
            llamadas: txsDia.length,
            minutos: txsDia.reduce((s, t) => {
              const match = t.descripcion?.match(/Llamada (\d+)s/);
              return s + (match ? parseInt(match[1]) : 0);
            }, 0),
            costo: txsDia.reduce((s, t) => s + Math.abs(t.monto), 0),
          };
        });

        const gastoHoy = dias[6]?.costo ?? 0;

        const estadoCitas = ["agendado", "asistio", "no_asistio", "cancelado"].map((estado) => ({
          estado,
          cantidad: apptData.appointments.filter((a) => a.status === estado).length,
        }));

        setData({
          totalCitas: apptData.appointments.length,
          citasHoy,
          citasProximas,
          totalLlamadas: debitos.length,
          minutosLlamada: debitos.reduce((s, t) => {
            const match = t.descripcion?.match(/Llamada (\d+)s/);
            return s + (match ? parseInt(match[1]) : 0);
          }, 0),
          gastoHoy,
          llamadasUltimos7Dias: dias,
          estadoCitas,
          transacciones: txData.transactions.slice(0, 8),
        });
      })
      .finally(() => setLoading(false));
  }, [usuario]);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="panel-wa">
            <CardContent className="p-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: "Citas totales",
      value: data.totalCitas.toString(),
      icon: CalendarClock,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Citas hoy",
      value: data.citasHoy.toString(),
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Llamadas (7d)",
      value: data.totalLlamadas.toString(),
      icon: PhoneCall,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Minutos conversados",
      value: Math.floor(data.minutosLlamada / 60).toString(),
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="panel-wa">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {kpi.label}
                  </span>
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                    <Icon className={cn("h-4 w-4", kpi.color)} />
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico llamadas 7 días */}
        <Card className="panel-wa lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Llamadas — últimos 7 días</CardTitle>
            <CardDescription>
              Volumen de llamadas procesadas y minutos conversados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.llamadasUltimos7Dias}>
                <defs>
                  <linearGradient id="colorLlamadas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00a884" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00a884" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(134,150,160,0.15)" />
                <XAxis
                  dataKey="dia"
                  stroke="#8696a0"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#8696a0" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="llamadas"
                  stroke="#00a884"
                  strokeWidth={2}
                  fill="url(#colorLlamadas)"
                  name="Llamadas"
                />
                <Area
                  type="monotone"
                  dataKey="minutos"
                  stroke="#34b7f1"
                  strokeWidth={2}
                  fillOpacity={0}
                  name="Minutos"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribución estados de citas */}
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base">Estado de Citas</CardTitle>
            <CardDescription>Distribución actual</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.estadoCitas}
                  dataKey="cantidad"
                  nameKey="estado"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {data.estadoCitas.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.estado]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas citas */}
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Próximas citas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              {data.citasProximas.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No hay citas próximas
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {data.citasProximas.map((cita) => (
                    <div key={cita.id} className="p-3 flex items-center gap-3 hover:bg-muted/30">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {format(new Date(cita.startTime), "dd")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{cita.customerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(cita.startTime), "EEE d 'de' MMM, HH:mm", { locale: es })}
                          {cita.recursoId && ` · ${cita.recursoId}`}
                        </div>
                        {cita.servicio && (
                          <div className="text-xs font-medium text-primary truncate">{cita.servicio}</div>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          borderColor: STATUS_COLORS[cita.status],
                          color: STATUS_COLORS[cita.status],
                        }}
                      >
                        {cita.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

      {/* Actividad reciente */}
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Historial de Llamadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              {data.transacciones.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Sin actividad reciente
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {data.transacciones
                    .filter(tx => {
                      if (tx.tipo === 'ganancia_cliente') return true;
                      if (tx.tipo === 'debito') {
                         // Mostrar débito solo si no hay ganancia_cliente para esta misma llamada (ej: B2B sin cobro a cliente)
                         const tieneGanancia = data.transacciones.some(t => t.tipo === 'ganancia_cliente' && t.callSid === tx.callSid && t.callSid);
                         return !tieneGanancia;
                      }
                      return false;
                    })
                    .map((tx) => {
                    let cleanDesc = tx.descripcion || tx.tipo;
                    if (cleanDesc.startsWith("Llamada v3:") || cleanDesc.startsWith("Ganancia por cliente final")) {
                      const match = cleanDesc.match(/-\s*(\d+s)/);
                      const duracion = match ? ` (${match[1]})` : "";
                      cleanDesc = `Llamada con IA${duracion}`;
                    }

                    const isPositive = tx.monto > 0;

                    return (
                      <div key={tx.id} className="p-3 flex items-center gap-3 hover:bg-muted/30">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0", isPositive ? "bg-emerald-500/10 text-emerald-600" : "bg-purple-500/10 text-purple-600")}>
                          <PhoneCall className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {cleanDesc}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(tx.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </div>
                        </div>
                        <div className={cn("text-sm font-bold", isPositive ? "text-emerald-600 tabular-nums" : "text-muted-foreground")}>
                          {isPositive ? `+$${Math.abs(tx.monto).toFixed(2)}` : "Completada"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
