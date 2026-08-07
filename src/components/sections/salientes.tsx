"use client";

import * as React from "react";
import { PhoneOutgoing, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface NumeroPropio {
  id: number;
  phoneNumber: string;
  isActive: boolean;
}

export function SalientesSection() {
  const { usuario } = useAppStore();
  const [numeros, setNumeros] = React.useState<NumeroPropio[]>([]);
  const [origen, setOrigen] = React.useState("");
  const [destino, setDestino] = React.useState("");
  const [llamando, setLlamando] = React.useState(false);

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
    try {
      await ApiClient.post("/api/outbound-call", {
        userId: usuario.id,
        from: origen,
        to: limpio,
      });
      toast.success("Llamada iniciada: cuando contesten, la IA tomará la llamada.");
      setDestino("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLlamando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="panel-wa">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneOutgoing className="h-4 w-4 text-primary" />
            Llamar con la IA
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
                <PhoneOutgoing className="h-4 w-4 mr-2" />
                {llamando ? "Llamando..." : "Llamar con IA"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-muted-foreground flex gap-2">
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
    </div>
  );
}
