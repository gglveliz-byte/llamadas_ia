"use client";

import * as React from "react";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon, Users, Copy, TrendingUp, Sparkles, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function AfiliadoDashboardSection() {
  const { usuario } = useAppStore();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      if (!usuario) return;
      setLoading(true);
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${backendUrl}/api/affiliate/dashboard`, {
          headers: {
            "x-affiliate-id": usuario.id,
          }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          toast.error("Error al cargar dashboard");
        }
      } catch (e) {
        console.error("Error fetching affiliate dashboard data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [usuario]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Enlace copiado al portapapeles");
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando métricas de afiliado...</div>;

  const urlReferido = typeof window !== 'undefined' ? `${window.location.origin}/ref/${usuario?.slug}` : '';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent">
            Panel de Afiliado
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenido, {usuario?.nombre || usuario?.email}. Aquí están tus resultados.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-blue-500/20 bg-blue-500/5 shadow-xl">
          <CardHeader>
            <CardTitle className="text-blue-600 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Ganancias Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-blue-600 mb-2">
              ${data?.gananciasGeneradas.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">USD Acumulados</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-500">
              <Users className="h-5 w-5" />
              Negocios Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-indigo-500 mb-2">
              {data?.negociosActivos}
            </div>
            <p className="text-sm text-muted-foreground">Usuarios utilizando el sistema</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-white/5 md:col-span-1 flex flex-col justify-center">
          <CardHeader>
             <CardTitle className="text-sm font-semibold text-muted-foreground">Tu enlace de referido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-secondary/50 rounded-lg border border-border flex items-center justify-between gap-4 overflow-hidden">
              <span className="text-sm truncate font-medium">{urlReferido}</span>
              <Button size="icon" variant="ghost" onClick={() => copyToClipboard(urlReferido)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Tus Referidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {data?.referidos.map((ref: any) => (
                <div key={ref.id} className="flex justify-between items-center p-4 rounded-xl border border-border bg-card hover:bg-secondary/20 transition-colors">
                  <div className="space-y-1">
                    <div className="font-semibold">{ref.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      Registrado el {format(new Date(ref.fecha), "dd MMM yyyy", { locale: es })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-500">+${ref.generado.toFixed(2)} USD</div>
                    <div className="text-xs text-muted-foreground">Generado</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
