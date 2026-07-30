"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Calendar,
} from "lucide-react";
import { ApiClient, type Cashflow } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function AdminFlujoSection() {
  const [data, setData] = React.useState<Cashflow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const cargar = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
      const d = await ApiClient.get<Cashflow>(`/api/admin/cashflow?${params.toString()}`);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const exportarCSV = () => {
    if (!data) return;
    const filas = [
      ["Fecha", "Tipo", "Monto", "Saldo nuevo", "Descripción", "Cliente"],
      ...data.transacciones.map((t) => [
        new Date(t.createdAt).toLocaleString("es-MX"),
        t.tipo,
        t.monto.toFixed(4),
        t.saldoNuevo.toFixed(4),
        t.descripcion || "",
        t.user?.businessName || "",
      ]),
    ];
    const csv = filas.map((f) => f.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flujo-caja-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="panel-wa">
            <CardContent className="p-6">
              <div className="h-24 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const serieFormateada = data.serie.map((s) => ({
    ...s,
    diaFormat: format(parseISO(s.dia), "d MMM", { locale: es }),
  }));

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Desde</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44 h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Hasta</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-44 h-9"
          />
        </div>
        <Button onClick={cargar} size="sm">
          <Calendar className="h-3.5 w-3.5 mr-1" />
          Aplicar
        </Button>
        <Button variant="outline" size="sm" onClick={exportarCSV}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="panel-wa">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Ingresos (recargas)
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              ${data.totalRecargas.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="panel-wa">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Consumido (débitos)
              </span>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600">
              ${data.totalDebitos.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="panel-wa">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Balance neto
              </span>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600">
              ${data.balance.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="panel-wa">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Transacciones
              </span>
            </div>
            <div className="text-2xl font-bold">{data.totalTransacciones}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card className="panel-wa">
        <CardHeader>
          <CardTitle className="text-base">Flujo de caja diario</CardTitle>
          <CardDescription>
            Ingresos (recargas Whop) vs Débitos (consumo llamadas)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serieFormateada.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={serieFormateada}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(134,150,160,0.15)" />
                <XAxis
                  dataKey="diaFormat"
                  stroke="#8696a0"
                  fontSize={11}
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
                  formatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="recargas" fill="#10b981" name="Recargas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="debitos" fill="#ef4444" name="Débitos" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Balance"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              No hay datos en este rango
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla transacciones */}
      <Card className="panel-wa">
        <CardHeader>
          <CardTitle className="text-base">Transacciones recientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transacciones.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">
                      {format(new Date(t.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {t.user?.businessName || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          t.tipo === "recarga"
                            ? "text-[10px] text-emerald-700 border-emerald-500/30 bg-emerald-500/10"
                            : t.tipo === "debito"
                            ? "text-[10px] text-red-700 border-red-500/30 bg-red-500/10"
                            : "text-[10px]"
                        }
                      >
                        {t.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.descripcion || "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        t.monto > 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {t.monto > 0 ? "+" : "-"}${Math.abs(t.monto).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
