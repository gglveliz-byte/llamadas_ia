"use client";

import * as React from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Sparkles,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings2,
  CheckCircle2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient, type RechargePackage, type WalletTransaction } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TX_LABEL: Record<string, { label: string; color: string }> = {
  recarga: { label: "Recarga", color: "text-emerald-600" },
  debito: { label: "Débito", color: "text-red-600" },
  ajuste_admin: { label: "Ajuste admin", color: "text-amber-600" },
  trial: { label: "Trial", color: "text-blue-600" },
};

export function RecargasSection() {
  const { usuario, refreshWallet } = useAppStore();
  const [saldo, setSaldo] = React.useState(0);
  const [totalRecargado, setTotalRecargado] = React.useState(0);
  const [totalDebitado, setTotalDebitado] = React.useState(0);
  const [porcentaje, setPorcentaje] = React.useState(100);
  const [paquetes, setPaquetes] = React.useState<RechargePackage[]>([]);
  const [txs, setTxs] = React.useState<WalletTransaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [paqueteSel, setPaqueteSel] = React.useState<RechargePackage | null>(null);
  const [processing, setProcessing] = React.useState(false);

  const cargar = React.useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const [w, p, t] = await Promise.all([
        ApiClient.get<{
          wallet: { saldo: number };
          totalRecargado: number;
          totalDebitado: number;
          porcentajeSaldo: number;
        }>(`/api/wallet?userId=${usuario.id}`),
        ApiClient.get<{ paquetes: RechargePackage[] }>("/api/packages"),
        ApiClient.get<{ transactions: WalletTransaction[] }>(
          `/api/wallet/transactions?userId=${usuario.id}&limit=100`
        ),
      ]);
      setSaldo(w.wallet.saldo);
      setTotalRecargado(w.totalRecargado);
      setTotalDebitado(w.totalDebitado);
      setPorcentaje(w.porcentajeSaldo);
      setPaquetes(p.paquetes);
      setTxs(t.transactions);
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const iniciarRecarga = (p: RechargePackage) => {
    setPaqueteSel(p);
    setCheckoutOpen(true);
  };

  const confirmarRecarga = async () => {
    if (!usuario || !paqueteSel) return;
    setProcessing(true);
    try {
      // Simular webhook Whop payment.succeeded
      await ApiClient.post("/api/wallet/recharge", {
        userId: usuario.id,
        packageId: paqueteSel.id,
        whopPaymentId: "whop_demo_" + Date.now(),
        amountAfterFees: paqueteSel.montoRecarga,
      });
      toast.success(`¡Recarga exitosa! +$${paqueteSel.saldoOtorgado.toFixed(2)}`);
      setCheckoutOpen(false);
      refreshWallet();
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
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

  const colorSaldo =
    porcentaje > 50
      ? "text-emerald-600 dark:text-emerald-400"
      : porcentaje > 20
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="panel-wa">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Saldo actual
              </span>
              <Wallet className={cn("h-4 w-4", colorSaldo)} />
            </div>
            <div className={cn("text-3xl font-bold", colorSaldo)}>
              ${saldo.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {porcentaje.toFixed(0)}% de la última recarga
            </div>
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  porcentaje > 50
                    ? "bg-emerald-500"
                    : porcentaje > 20
                    ? "bg-amber-500"
                    : "bg-red-500"
                )}
                style={{ width: `${Math.min(100, Math.max(5, porcentaje))}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="panel-wa">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total recargado
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-bold text-emerald-600">
              ${totalRecargado.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Histórico</div>
          </CardContent>
        </Card>

        <Card className="panel-wa">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total consumido
              </span>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-3xl font-bold text-red-600">
              ${totalDebitado.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Por llamadas</div>
          </CardContent>
        </Card>
      </div>

      {/* Paquetes de recarga */}
      <Card className="panel-wa">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Paquetes de recarga
          </CardTitle>
          <CardDescription>
            Los pagos se procesan de forma segura a través de Whop.com. El saldo se acredita
            automáticamente tras la confirmación del pago.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {paquetes.map((p) => {
              const popular = p.nombre === "Pro";
              return (
                <div
                  key={p.id}
                  className={cn(
                    "relative rounded-xl border-2 p-4 flex flex-col",
                    popular
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {popular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px]">
                      Más popular
                    </Badge>
                  )}
                  <div className="text-sm font-bold mb-1">{p.nombre}</div>
                  <div className="text-2xl font-bold mb-1">
                    ${p.saldoOtorgado.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-3">saldo USD</div>
                  <div className="text-xs text-muted-foreground mb-1">Pago</div>
                  <div className="text-lg font-semibold mb-1">
                    ${p.montoRecarga.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-3">
                    ${p.precioPorMinuto.toFixed(3)}/min
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={popular ? "default" : "outline"}
                    onClick={() => iniciarRecarga(p)}
                    disabled={p.montoRecarga === 0}
                  >
                    {p.montoRecarga === 0 ? "Agotado" : "Recargar"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="panel-wa">
        <CardHeader>
          <CardTitle className="text-base">Historial de transacciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-96">
            {txs.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No hay transacciones
              </div>
            ) : (
              <div className="divide-y divide-border">
                {txs.map((tx) => {
                  const meta = TX_LABEL[tx.tipo] ?? { label: tx.tipo, color: "" };
                  return (
                    <div key={tx.id} className="p-3 flex items-center gap-3 hover:bg-muted/30">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0",
                          tx.monto > 0
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-600"
                        )}
                      >
                        {tx.monto > 0 ? (
                          <ArrowDownCircle className="h-4 w-4" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {tx.descripcion || meta.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(tx.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                          {tx.callSid && ` · ${tx.callSid.slice(0, 14)}...`}
                          {tx.whopPaymentId && ` · Whop: ${tx.whopPaymentId.slice(-8)}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("text-sm font-bold tabular-nums", meta.color)}>
                          {tx.monto > 0 ? "+" : "-"}${Math.abs(tx.monto).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Saldo: ${tx.saldoNuevo.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Modal checkout Whop (simulado) */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Confirmar recarga
            </DialogTitle>
            <DialogDescription>
              Serás redirigido a Whop.com para completar el pago de forma segura.
            </DialogDescription>
          </DialogHeader>
          {paqueteSel && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Paquete</span>
                  <span className="text-sm font-semibold">{paqueteSel.nombre}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Saldo a recibir</span>
                  <span className="text-sm font-bold text-emerald-600">
                    +${paqueteSel.saldoOtorgado.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Precio</span>
                  <span className="text-sm font-bold">${paqueteSel.montoRecarga.toFixed(2)} USD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tarifa/min</span>
                  <span className="text-sm">${paqueteSel.precioPorMinuto.toFixed(3)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-300">
                <CheckCircle2 className="h-4 w-4 inline mr-1" />
                Demo: al confirmar se simula el webhook <code className="font-mono">payment.succeeded</code> de Whop y se acredita el saldo al instante.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarRecarga} disabled={processing}>
              {processing ? "Procesando..." : `Pagar $${paqueteSel?.montoRecarga.toFixed(2)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
