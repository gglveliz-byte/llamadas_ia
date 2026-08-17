"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function CustomerBalance({ tenantId, countryData }: { tenantId: string, countryData?: { code: string, flag: string } }) {
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [saldoInfo, setSaldoInfo] = useState<{ saldoDinero: string, saldoMinutos: string } | null>(null);
  const [error, setError] = useState("");
  const [refundStatus, setRefundStatus] = useState("");

  const handleConsultar = async () => {
    setLoading(true);
    setError("");
    setSaldoInfo(null);
    setRefundStatus("");
    
    try {
      // Si hay prefijo, asegúrate de que el teléfono empiece con él para enviar al backend
      const phoneToSend = (countryData && countryData.code && !telefono.startsWith(countryData.code)) 
        ? `${countryData.code}${telefono}` 
        : telefono;

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/public/customer/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, telefono: phoneToSend })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Error al consultar");
      } else {
        setSaldoInfo({
          saldoDinero: parseFloat(data.saldoDinero).toFixed(2),
          saldoMinutos: parseFloat(data.saldoMinutos).toFixed(2)
        });
      }
    } catch (e) {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  const handleReembolso = async () => {
    if (!saldoInfo || parseFloat(saldoInfo.saldoDinero) <= 0) return;
    setLoading(true);
    try {
      const phoneToSend = (countryData && countryData.code && !telefono.startsWith(countryData.code)) 
        ? `${countryData.code}${telefono}` 
        : telefono;

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/public/customer/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tenantId, 
          telefono: phoneToSend,
          montoSolicitado: parseFloat(saldoInfo.saldoDinero)
        })
      });
      if (res.ok) {
        setRefundStatus("¡Solicitud enviada! Nos pondremos en contacto contigo pronto.");
        setSaldoInfo(null);
      } else {
        const data = await res.json();
        setError(data.error || "Error al solicitar reembolso");
      }
    } catch (e) {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Consultar Saldo / Reembolsos</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Consultar Saldo</DialogTitle>
          <DialogDescription>
            Ingresa tu número de teléfono para ver tu saldo a favor o solicitar un reembolso.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="tel-consulta">Número de Teléfono</Label>
            {countryData && countryData.code ? (
              <div className="flex">
                <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 border-r-0 rounded-l-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground shadow-sm">
                  <span className="mr-1.5 text-base">{countryData.flag}</span>
                  {countryData.code}
                </div>
                <Input 
                  id="tel-consulta" 
                  type="tel"
                  placeholder="99 123 4567" 
                  value={telefono} 
                  onChange={(e) => setTelefono(e.target.value)}
                  dir="ltr"
                  className="rounded-l-none"
                />
              </div>
            ) : (
              <Input 
                id="tel-consulta" 
                placeholder="+1234567890" 
                value={telefono} 
                onChange={(e) => setTelefono(e.target.value)}
              />
            )}
          </div>
          
          <Button onClick={handleConsultar} disabled={loading || !telefono}>
            {loading ? "Buscando..." : "Buscar Cuenta"}
          </Button>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          {refundStatus && <p className="text-green-500 text-sm font-medium">{refundStatus}</p>}

          {saldoInfo && (
            <div className="bg-slate-50 p-4 rounded-md mt-2 border border-slate-200">
              <h4 className="font-semibold mb-2">Resumen de tu cuenta</h4>
              <p className="text-sm">Minutos disponibles: <span className="font-bold">{saldoInfo.saldoMinutos} min</span></p>
              <p className="text-sm">Saldo a favor: <span className="font-bold">${saldoInfo.saldoDinero}</span></p>
              
              {parseFloat(saldoInfo.saldoDinero) > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">
                    Si ya no planeas agendar más citas, puedes solicitar la devolución de tu saldo a favor.
                  </p>
                  <Button variant="destructive" size="sm" className="w-full" onClick={handleReembolso} disabled={loading}>
                    Solicitar Devolución (${saldoInfo.saldoDinero})
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
