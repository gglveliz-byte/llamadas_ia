"use client";

import * as React from "react";
import { CreditCard, CheckCircle2, Sparkles } from "lucide-react";
import { ApiClient, type RechargePackage } from "@/lib/api";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RechargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess?: () => void;
}

export function RechargeModal({ open, onOpenChange, userId, onSuccess }: RechargeModalProps) {
  const [paquetes, setPaquetes] = React.useState<RechargePackage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const [paqueteSel, setPaqueteSel] = React.useState<RechargePackage | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    ApiClient.get<{ paquetes: RechargePackage[] }>("/api/packages")
      .then((data) => setPaquetes(data.paquetes))
      .finally(() => setLoading(false));
  }, [open]);

  const iniciarRecarga = (p: RechargePackage) => {
    setPaqueteSel(p);
    setCheckoutSessionId(null);
    setConfirmOpen(true);
  };

  const confirmarRecarga = async () => {
    if (!paqueteSel) return;
    setProcessing(true);
    try {
      const { checkoutUrl, checkoutId } = await ApiClient.post<{ checkoutUrl: string; checkoutId?: string }>(
        "/api/whop/checkout",
        { packageId: paqueteSel.id }
      );
      if (checkoutId) {
        setCheckoutSessionId(checkoutId);
      } else {
        window.location.href = checkoutUrl;
      }
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Paquetes de recarga
            </DialogTitle>
            <DialogDescription>
              Selecciona un paquete. El pago se procesa de forma segura.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-24 animate-pulse bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-2">
              {paquetes.map((p) => {
                const popular = p.nombre === "Pro";
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "relative rounded-xl border-2 p-4 flex flex-col cursor-pointer transition-all hover:scale-[1.02]",
                      popular
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    )}
                    onClick={() => iniciarRecarga(p)}
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
                    <div className="text-[10px] text-muted-foreground">
                      ${p.precioPorMinuto.toFixed(3)}/min
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(v) => {
        setConfirmOpen(v);
        if (!v) setCheckoutSessionId(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {checkoutSessionId ? "Completar pago seguro" : "Confirmar recarga"}
            </DialogTitle>
            <DialogDescription>
              {checkoutSessionId
                ? "Introduce tu método de pago de forma segura a través de Whop."
                : "Serás redirigido a un portal de pago seguro para completar la compra."}
            </DialogDescription>
          </DialogHeader>
          
          {checkoutSessionId ? (
            <div className="py-2 h-[500px]">
              <WhopCheckoutEmbed
                sessionId={checkoutSessionId}
                returnUrl={`${window.location.origin}/dashboard?recarga=exito`}
                theme="system"
                onComplete={() => {
                  setConfirmOpen(false);
                  setCheckoutSessionId(null);
                  toast.success("¡Pago completado con éxito!");
                  if (onSuccess) onSuccess();
                }}
              />
            </div>
          ) : (
            paqueteSel && (
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
              </div>
            )
          )}
          
          {!checkoutSessionId && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={confirmarRecarga} disabled={processing}>
                {processing ? "Procesando..." : `Pagar $${paqueteSel?.montoRecarga.toFixed(2)}`}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
