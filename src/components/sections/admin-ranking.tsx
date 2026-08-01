"use client";

import * as React from "react";
import {
  Trophy,
  Medal,
  Award,
  Download,
  TrendingUp,
  Phone,
  DollarSign,
  Clock,
  Loader2,
  BarChart3,
} from "lucide-react";
import { ApiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

interface RankingItem {
  posicion: number;
  userId: string;
  email: string;
  businessName: string;
  isSuspended: boolean;
  gastoTotal: number;
  recargaTotal: number;
  saldo: number;
  minutos: number;
  llamadas: number;
  primeraLlamada: string | null;
  ultimaLlamada: string | null;
  puntaje: number;
}

interface RankingResponse {
  ranking: RankingItem[];
  resumen: {
    totalClientes: number;
    clientesActivos: number;
    totalMinutos: number;
    totalGasto: number;
    totalRecargas: number;
  };
}

const medallas = [
  <Trophy key={1} className="h-4 w-4 text-yellow-500" />,
  <Medal key={2} className="h-4 w-4 text-gray-400" />,
  <Award key={3} className="h-4 w-4 text-amber-600" />,
];

function csvEscape(val: string | number | null): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function AdminRankingSection() {
  const [data, setData] = React.useState<RankingResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await ApiClient.get<RankingResponse>("/api/admin/ranking");
        setData(res);
      } catch (err) {
        console.error("Error al cargar ranking:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const exportarCSV = () => {
    if (!data) return;
    const headers = [
      "Posicion",
      "Negocio",
      "Email",
      "Gasto Total",
      "Recarga Total",
      "Saldo Actual",
      "Minutos",
      "Llamadas",
      "Suspenso",
      "Puntaje",
    ];
    const rows = data.ranking.map((r) => [
      r.posicion,
      csvEscape(r.businessName),
      csvEscape(r.email),
      r.gastoTotal.toFixed(2),
      r.recargaTotal.toFixed(2),
      r.saldo.toFixed(2),
      r.minutos,
      r.llamadas,
      r.isSuspended ? "Si" : "No",
      r.puntaje.toFixed(1),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ranking-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ranking de Clientes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Top 10 clientes por consumo y actividad
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-medium">
              Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" />
              {data?.resumen.totalClientes}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {data?.resumen.clientesActivos} activos
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-medium">
              Minutos totales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-500" />
              {data?.resumen.totalMinutos.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-medium">
              Gasto total
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-red-500" />
              ${data?.resumen.totalGasto.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-medium">
              Recargas totales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              ${data?.resumen.totalRecargas.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-medium">
              Llamadas totales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-purple-500" />
              {data?.ranking.reduce((s, r) => s + r.llamadas, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Top 10</CardTitle>
            <CardDescription>Ordenado por puntaje de consumo</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportarCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Minutos</TableHead>
                  <TableHead className="text-right">Llamadas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.ranking.map((r) => (
                  <TableRow key={r.userId} className={r.isSuspended ? "opacity-50" : undefined}>
                    <TableCell className="text-center font-medium">
                      <div className="flex items-center justify-center">
                        {r.posicion <= 3 ? (
                          medallas[r.posicion - 1]
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.posicion}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.businessName}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.email}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${r.gastoTotal.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.minutos.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{r.llamadas}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span
                        className={cn(
                          r.saldo > 0
                            ? r.saldo > (r.recargaTotal || 1) * 0.5
                              ? "text-emerald-600"
                              : r.saldo > (r.recargaTotal || 1) * 0.2
                                ? "text-amber-600"
                                : "text-red-600"
                            : "text-muted-foreground"
                        )}
                      >
                        ${r.saldo.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.isSuspended ? (
                        <Badge variant="destructive" className="text-[10px] h-4">
                          Suspendido
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] h-4">
                          Activo
                        </Badge>
                      )}
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
