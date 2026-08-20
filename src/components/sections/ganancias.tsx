"use client";

import * as React from "react";
import {
  Wallet,
  TrendingUp,
  History,
  Link as LinkIcon,
  Copy,
  CheckCircle2,
  Users,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient, type WalletTransaction } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export function GananciasSection() {
  const { usuario, refreshWallet } = useAppStore();
  const [saldo, setSaldo] = React.useState(0);
  const [txs, setTxs] = React.useState<WalletTransaction[]>([]);
  const [clientes, setClientes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [slug, setSlug] = React.useState("");

  const cargar = React.useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const [w, t, s, c] = await Promise.all([
        ApiClient.get<{ wallet: { saldo: number } }>(`/api/wallet?userId=${usuario.id}`),
        ApiClient.get<{ transactions: WalletTransaction[] }>(`/api/wallet/transactions?userId=${usuario.id}`),
        ApiClient.get<{ settings: { registrationSlug?: string } }>(`/api/business-settings?userId=${usuario.id}`),
        ApiClient.get<{ endCustomers: any[] }>(`/api/end-customers?userId=${usuario.id}`)
      ]);
      setSaldo(w.wallet?.saldo || 0);
      setTxs(t.transactions || []);
      setClientes(c.endCustomers || []);
      if (s.settings?.registrationSlug) {
        setSlug(s.settings.registrationSlug);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Enlace copiado al portapapeles");
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando ganancias...</div>;
  }

  const landingUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${slug || usuario?.id}` : '';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
            Ganancias y Clientes
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitorea el dinero generado por tu sistema automatizado.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={cargar}>
          <History className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm relative overflow-hidden group col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Ganancias
              </span>
            </div>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              ${saldo.toFixed(2)} <span className="text-lg text-muted-foreground">USD</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-white/5 col-span-2">
          <CardContent className="p-5 flex flex-col justify-center h-full space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-500">
              <LinkIcon className="h-4 w-4" />
              Tu Enlace de Agendamiento
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-3 py-2 bg-secondary/50 rounded-md border border-border flex items-center justify-between overflow-hidden">
                <span className="text-sm truncate font-medium">{landingUrl}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6 ml-2" onClick={() => copyToClipboard(landingUrl)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={() => window.open(landingUrl, '_blank')}>
                Ver portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Historial de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-secondary/30 rounded-lg border border-dashed">
              <Wallet className="h-12 w-12 mx-auto opacity-20 mb-3" />
              No hay movimientos todavía
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border">
                {txs.map((tx) => {
                  let cleanDesc = tx.descripcion || tx.tipo;
                  if (cleanDesc.startsWith("Llamada v3:")) {
                    const parts = cleanDesc.split(" - ");
                    cleanDesc = parts.length > 1 ? `Pago por llamada (${parts[1]})` : "Pago por llamada";
                  }

                  return (
                    <div
                      key={tx.id}
                      className="flex justify-between items-center py-3 px-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500/10 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">
                            {cleanDesc}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          +${Math.abs(tx.monto).toFixed(2)} USD
                        </div>
                        <Badge variant="outline" className="mt-1 text-[10px] bg-emerald-500/5 text-emerald-600 border-emerald-500/20">
                          Ganancia
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-white/5 mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Clientes Registrados
          </CardTitle>
          <CardDescription>
            Lista de personas que se han registrado a través de tu enlace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-secondary/30 rounded-lg border border-dashed">
              <Users className="h-12 w-12 mx-auto opacity-20 mb-3" />
              Aún no tienes clientes registrados
            </div>
          ) : (
            <>
              {/* Vista Desktop (Tabla) */}
              <div className="hidden md:block rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Saldo Dinero</TableHead>
                      <TableHead className="text-right">Saldo Minutos</TableHead>
                      <TableHead className="text-right">Registrado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nombre}</TableCell>
                        <TableCell className="font-mono text-xs">{c.telefono}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          ${Number(c.saldoDinero).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(c.saldoMinutos).toFixed(2)} min
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {format(new Date(c.createdAt), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Vista Móvil (Tarjetas) */}
              <div className="md:hidden space-y-3">
                {clientes.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-base">{c.nombre}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{c.email || "Sin email"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-0.5">Saldo</div>
                        <div className="font-bold text-emerald-600 text-lg leading-none">
                          ${Number(c.saldoDinero).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end pt-3 border-t">
                      <div className="space-y-1">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Teléfono</div>
                        <div className="font-mono text-sm">{c.telefono}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Minutos</div>
                        <div className="text-sm font-medium">{Number(c.saldoMinutos).toFixed(2)} min</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
