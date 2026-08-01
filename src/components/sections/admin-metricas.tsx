"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Cpu,
  MemoryStick,
  Gauge,
  PhoneCall,
  Activity,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";
import { ApiClient, type MetricasAdmin } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function AdminMetricasSection() {
  const [data, setData] = React.useState<MetricasAdmin | null>(null);
  const [loading, setLoading] = React.useState(true);

  const cargar = React.useCallback(async () => {
    try {
      // Primero intentar leer del backend Express real (vía proxy de Next.js)
      let d: MetricasAdmin | null = null;
      try {
        const expressRes = await fetch(`/api/express/metrics`);
        if (expressRes.ok) {
          d = (await expressRes.json()) as MetricasAdmin;
          console.log("[Métricas] Leyendo del backend Express (puerto 3001)");
        }
      } catch (e) {
        console.warn("[Métricas] Express no disponible, fallback a /api/admin/metrics");
      }

      // Fallback a la API local de Next.js
      if (!d) {
        d = await ApiClient.get<MetricasAdmin>("/api/admin/metrics");
      }
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 10000); // refresca cada 10s como en el spec
    return () => clearInterval(interval);
  }, [cargar]);

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

  const { actual, historial, aggregate, rateLimits, umbrales, fuente } = data;

  const esFallback = fuente === "fallback-db";

  const alertasActivas: Array<{ tipo: string; valor: string; umbral: string }> = [];
  if (actual.cpu > umbrales.cpu) alertasActivas.push({ tipo: "CPU", valor: actual.cpu.toFixed(1) + "%", umbral: umbrales.cpu + "%" });
  if (actual.ram > umbrales.ram) alertasActivas.push({ tipo: "RAM", valor: actual.ram.toFixed(1) + "%", umbral: umbrales.ram + "%" });
  if (actual.latencia > umbrales.latencia) alertasActivas.push({ tipo: "Latencia", valor: actual.latencia.toFixed(0) + "ms", umbral: umbrales.latencia + "ms" });

  const kpis = [
    {
      label: "CPU",
      valor: actual.cpu,
      umbral: umbrales.cpu,
      icon: Cpu,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
      suffix: "%",
    },
    {
      label: "RAM",
      valor: actual.ram,
      umbral: umbrales.ram,
      icon: MemoryStick,
      color: "text-purple-600",
      bg: "bg-purple-500/10",
      suffix: "%",
    },
    {
      label: "Latencia",
      valor: actual.latencia,
      umbral: umbrales.latencia,
      icon: Gauge,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
      suffix: "ms",
    },
    {
      label: "Llamadas activas",
      valor: actual.llamadasActivas,
      umbral: 50,
      icon: PhoneCall,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
      suffix: "",
    },
  ];

  // Formatear historial para el chart
  const historialFormateado = historial.map((h) => ({
    ...h,
    hora: new Date(h.ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  }));

  return (
    <div className="space-y-6">
      {/* Banner de fuente de datos */}
      <Card className={cn("panel-wa", esFallback ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5")}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className={cn("h-2 w-2 rounded-full animate-pulse", esFallback ? "bg-amber-500" : "bg-emerald-500")} />
          <div className="text-xs">
            {esFallback ? (
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Backend Express no disponible — mostrando agregados de BD
              </span>
            ) : (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Conectado al backend Express
              </span>
            )}
            <span className="text-muted-foreground ml-2">
              Métricas en tiempo real cada 10s · WebSocket Telnyx Stream activo · SSE broadcasting
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {alertasActivas.length > 0 && (
        <Card className="panel-wa border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-destructive">
                  Alertas activas ({alertasActivas.length})
                </div>
                <div className="text-xs space-y-0.5">
                  {alertasActivas.map((a, i) => (
                    <div key={i}>
                      <strong>{a.tipo}:</strong> {a.valor} supera el umbral de {a.umbral}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs en tiempo real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const alerta = kpi.valor > kpi.umbral;
          const pct = kpi.suffix === "%" ? kpi.valor : (kpi.valor / kpi.umbral) * 100;
          return (
            <Card key={kpi.label} className={cn("panel-wa", alerta && "border-destructive/40")}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {kpi.label}
                  </span>
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                    <Icon className={cn("h-4 w-4", kpi.color)} />
                  </div>
                </div>
                <div className={cn("text-2xl font-bold", alerta && "text-destructive")}>
                  {typeof kpi.valor === "number" ? kpi.valor.toFixed(kpi.suffix === "ms" ? 0 : 1) : kpi.valor}
                  <span className="text-base text-muted-foreground ml-1">{kpi.suffix}</span>
                </div>
                <Progress
                  value={Math.min(100, pct)}
                  className={cn("h-1 mt-2", alerta && "[&>div]:bg-destructive")}
                />
                <div className="text-[10px] text-muted-foreground mt-1">
                  Umbral: {kpi.umbral}{kpi.suffix}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Gráfico histórico */}
      <Card className="panel-wa">
        <CardHeader>
          <CardTitle className="text-base">Histórico — últimas 60 mediciones (10 min)</CardTitle>
          <CardDescription>
            CPU, RAM y latencia medidas cada 10 segundos por el servicio de monitoreo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historialFormateado}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(134,150,160,0.15)" />
              <XAxis
                dataKey="hora"
                stroke="#8696a0"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke="#8696a0" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <ReferenceLine y={umbrales.cpu} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "CPU", fontSize: 10, fill: "#ef4444" }} />
              <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU %" />
              <Line type="monotone" dataKey="ram" stroke="#a855f7" strokeWidth={2} dot={false} name="RAM %" />
              <Line type="monotone" dataKey="latencia" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latencia (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resumen agregado */}
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Resumen hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Clientes totales</span>
              <span className="font-semibold tabular-nums">{aggregate.totalClientes}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Suspendidos</span>
              <span className="font-semibold tabular-nums text-amber-600">{aggregate.clientesSuspendidos}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Llamadas hoy</span>
              <span className="font-semibold tabular-nums">{aggregate.llamadasHoy}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Minutos hoy</span>
              <span className="font-semibold tabular-nums">{aggregate.minutosHoy}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ingresos hoy</span>
              <span className="font-semibold tabular-nums text-emerald-600">
                ${aggregate.ingresosHoy.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recargas hoy</span>
              <span className="font-semibold tabular-nums text-blue-600">
                ${aggregate.recargasHoy.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Latencia promedio</span>
              <span className="font-semibold tabular-nums">
                {aggregate.latenciaPromedio.toFixed(0)}ms
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Errores recientes</span>
              <span className={cn(
                "font-semibold tabular-nums",
                aggregate.erroresRecientes > 0 ? "text-red-600" : "text-emerald-600"
              )}>
                {aggregate.erroresRecientes}/50
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Rate limits APIs */}
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" /> Rate Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Gemini API</span>
                <Badge variant="outline" className="text-[10px]">
                  {rateLimits.gemini.remaining}/{rateLimits.gemini.limit}
                </Badge>
              </div>
              <Progress
                value={(rateLimits.gemini.remaining / rateLimits.gemini.limit) * 100}
                className="h-2"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Resetea: {new Date(rateLimits.gemini.resetAt).toLocaleTimeString("es-MX")}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Telnyx concurrencia</span>
                <Badge variant="outline" className="text-[10px]">
                  {rateLimits.telnyx.concurrentCalls}/{rateLimits.telnyx.maxConcurrent}
                </Badge>
              </div>
              <Progress
                value={(rateLimits.telnyx.concurrentCalls / rateLimits.telnyx.maxConcurrent) * 100}
                className="h-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Whop webhook</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                  {rateLimits.whop.status}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Último: {new Date(rateLimits.whop.lastWebhook).toLocaleTimeString("es-MX")}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sistema */}
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4" /> Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Heap Node.js</span>
              <span className="font-semibold tabular-nums">{(actual.heapMb ?? actual.heap ?? 0).toFixed(1)} MB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-semibold tabular-nums">
                {Math.floor(actual.uptime / 3600)}h {Math.floor((actual.uptime % 3600) / 60)}m
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Última medición</span>
              <span className="font-semibold text-xs">
                {new Date(actual.ts).toLocaleTimeString("es-MX")}
              </span>
            </div>
            {actual.clientesSSE !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Clientes SSE</span>
                <span className="font-semibold tabular-nums text-emerald-600">
                  {actual.clientesSSE} conectados
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <div className="text-[10px] text-muted-foreground mb-1">Umbrales configurados</div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-muted/50 p-2">
                  <div className="text-muted-foreground text-[10px]">CPU</div>
                  <div className="font-semibold">{umbrales.cpu}%</div>
                </div>
                <div className="rounded bg-muted/50 p-2">
                  <div className="text-muted-foreground text-[10px]">RAM</div>
                  <div className="font-semibold">{umbrales.ram}%</div>
                </div>
                <div className="rounded bg-muted/50 p-2">
                  <div className="text-muted-foreground text-[10px]">Lat.</div>
                  <div className="font-semibold">{umbrales.latencia}ms</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
