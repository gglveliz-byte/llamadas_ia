"use client";

import * as React from "react";
import { PhoneOutgoing, Info, PhoneCall, Phone, Loader2, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useSSE } from "@/hooks/use-sse";

interface NumeroPropio {
  id: number;
  phoneNumber: string;
  isActive: boolean;
}

interface LlamadaItem {
  id: number;
  callSid: string | null;
  callerNumber: string | null;
  toNumber: string | null;
  inicio: string | null;
  fin: string | null;
  duracionSegundos: number | null;
  cobroAplicado: number | null;
  audioUrl: string | null;
}

export function SalientesSection() {
  const { usuario } = useAppStore();
  const { eventos } = useSSE();
  const [numeros, setNumeros] = React.useState<NumeroPropio[]>([]);
  const [origen, setOrigen] = React.useState("");
  const [destino, setDestino] = React.useState("");
  const [llamando, setLlamando] = React.useState(false);
  const [llamadas, setLlamadas] = React.useState<LlamadaItem[]>([]);

  const [llamadaActiva, setLlamadaActiva] = React.useState<{
    callId: string;
    destino: string;
    estado: "iniciando" | "sonando" | "contestada" | "finalizada";
  } | null>(null);

  React.useEffect(() => {
    if (!usuario) return;
    ApiClient.get<{ numbers: NumeroPropio[] }>(`/api/phone-numbers?userId=${usuario.id}`)
      .then((d) => {
        const activos = (d.numbers || []).filter((n) => n.isActive);
        setNumeros(activos);
        setOrigen((prev) => prev || activos[0]?.phoneNumber || "");
      })
      .catch(() => {});
  }, [usuario]);

  // Escuchar eventos SSE de estado de llamada
  React.useEffect(() => {
    if (eventos.length === 0 || !llamadaActiva) return;
    const ultimoEvento = eventos[eventos.length - 1];
    
    if (ultimoEvento.tipo === "estado_llamada") {
      const data = ultimoEvento.data as { callControlId: string; estado: "sonando" | "contestada" | "finalizada" };
      if (data.callControlId === llamadaActiva.callId) {
        setLlamadaActiva((prev) => prev ? { ...prev, estado: data.estado } : null);
      }
    }
  }, [eventos, llamadaActiva?.callId]);

  const cargarLlamadas = React.useCallback(async () => {
    if (!usuario) return;
    try {
      const data = await ApiClient.get<{ calls: LlamadaItem[] }>(`/api/calls?userId=${usuario.id}`);
      setLlamadas(data.calls || []);
    } catch {}
  }, [usuario]);

  React.useEffect(() => {
    cargarLlamadas();
  }, [cargarLlamadas]);

  const llamar = async () => {
    if (!usuario) return;
    const limpio = destino.replace(/[^\d+]/g, "");
    if (!origen) {
      toast.error("Necesitas un número activo como origen. Compra uno en Configuración → Números.");
      return;
    }
    if (limpio.length < 8) {
      toast.error("Ingresa un número destino válido, ej. +15551234567.");
      return;
    }
    setLlamando(true);
    setLlamadaActiva(null); // Resetear estado anterior
    try {
      const resp = await ApiClient.post<{ ok: boolean; callControlId: string }>("/api/outbound-call", {
        userId: usuario.id,
        from: origen,
        to: limpio,
      });
      
      setLlamadaActiva({
        callId: resp.callControlId,
        destino: destino,
        estado: "iniciando",
      });
      
      toast.success("Llamada iniciada. Rastrea el estado en tiempo real.");
      setDestino("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLlamando(false);
    }
  };

  const renderEstadoUI = () => {
    if (!llamadaActiva) return null;

    const config: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      iniciando: { label: "Iniciando...", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <Loader2 className="w-4 h-4 animate-spin" /> },
      sonando: { label: "Sonando...", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: <PhoneOutgoing className="w-4 h-4 animate-pulse" /> },
      contestada: { label: "En Curso (IA Activa)", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: <PhoneCall className="w-4 h-4 animate-pulse" /> },
      finalizada: { label: "Llamada Finalizada", color: "bg-slate-500/10 text-slate-600 border-slate-500/20", icon: <CheckCircle2 className="w-4 h-4" /> },
    };

    const cur = config[llamadaActiva.estado];

    return (
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Llamando a</p>
              <p className="text-lg font-bold">{llamadaActiva.destino}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={`gap-1.5 px-3 py-1 text-sm ${cur.color}`}>
              {cur.icon}
              {cur.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {renderEstadoUI()}

      <Card className="panel-wa">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneOutgoing className="h-4 w-4 text-primary" />
            Nueva Llamada
          </CardTitle>
          <CardDescription>
            Inicia una llamada saliente desde tu número: cuando el destino conteste, la IA se
            presenta y conversa (confirmaciones, seguimiento, información).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Número origen (tuyo)</Label>
              <Select value={origen} onValueChange={setOrigen}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin números activos" />
                </SelectTrigger>
                <SelectContent>
                  {numeros.map((n) => (
                    <SelectItem key={n.id} value={n.phoneNumber}>
                      {n.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número destino</Label>
              <Input
                placeholder="+15551234567"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={llamar} disabled={llamando || !origen} className="w-full">
                {llamando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PhoneOutgoing className="h-4 w-4 mr-2" />}
                {llamando ? "Llamando..." : "Llamar con IA"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-muted-foreground flex gap-2 mt-4">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                El consumo se descuenta de tu saldo por minuto, con la misma tarifa de tus
                llamadas entrantes. El proveedor cobra aparte el tránsito saliente.
              </p>
              <p>
                Usa formato internacional completo (ej. +1 para EE.UU., +593 Ecuador). La llamada
                aparecerá en tu Historial con duración, costo y grabación.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="panel-wa">
        <CardHeader>
          <CardTitle className="text-base">Historial de Llamadas Salientes</CardTitle>
          <CardDescription>Tus últimas llamadas realizadas desde esta pantalla.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {llamadas.filter(c => numeros.some(n => n.phoneNumber === c.callerNumber)).slice(0, 5).map((ll) => (
                  <TableRow key={ll.id}>
                    <TableCell className="text-xs">
                      {ll.inicio ? new Date(ll.inicio).toLocaleString() : "N/A"}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {ll.toNumber}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {ll.duracionSegundos ? `${ll.duracionSegundos}s` : "N/A"}
                    </TableCell>
                    <TableCell className="text-center">
                      {ll.fin ? (
                        <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20 text-xs">Finalizada</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs animate-pulse">En curso</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {llamadas.filter(c => numeros.some(n => n.phoneNumber === c.callerNumber)).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No has realizado llamadas salientes aún.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
