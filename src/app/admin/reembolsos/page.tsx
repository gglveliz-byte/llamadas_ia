"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

interface RefundRequest {
  id: string;
  endCustomerId: string;
  tenantId: string;
  montoSolicitado: string;
  status: string;
  whopPaymentId: string;
  createdAt: string;
  endCustomer: {
    nombre: string;
    telefono: string;
    email: string | null;
    saldoDinero: string;
  };
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRefunds = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${backendUrl}/admin/refunds`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setRefunds(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleComplete = async (id: string) => {
    if (!confirm("¿Ya emitiste el reembolso manualmente en el dashboard de Whop? Esta acción descontará el saldo del cliente.")) return;
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${backendUrl}/admin/refunds/${id}/complete`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchRefunds();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error de red");
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("¿Rechazar esta solicitud?")) return;
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const token = localStorage.getItem("adminToken");
      await fetch(`${backendUrl}/admin/refunds/${id}/reject`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      fetchRefunds();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reembolsos de Clientes Finales</h2>
        <p className="text-muted-foreground">
          Gestiona las solicitudes de devolución de depósito (Retención).
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente Final</TableHead>
              <TableHead>Monto a Devolver</TableHead>
              <TableHead>Ref. Pago (Whop)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando reembolsos...
                </TableCell>
              </TableRow>
            ) : refunds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay solicitudes de reembolso pendientes.
                </TableCell>
              </TableRow>
            ) : (
              refunds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <p className="font-medium">{r.endCustomer.nombre}</p>
                    <p className="text-xs text-muted-foreground">{r.endCustomer.telefono}</p>
                  </TableCell>
                  <TableCell className="font-bold text-red-600">
                    ${r.montoSolicitado}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 p-1 rounded">{r.whopPaymentId}</code>
                  </TableCell>
                  <TableCell>
                    {r.status === "pendiente" && <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pendiente</Badge>}
                    {r.status === "completado" && <Badge variant="outline" className="bg-green-50 text-green-700">Completado</Badge>}
                    {r.status === "rechazado" && <Badge variant="outline" className="bg-red-50 text-red-700">Rechazado</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pendiente" && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleComplete(r.id)} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Marcar Devuelto
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleReject(r.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="bg-amber-50 text-amber-900 p-4 rounded-md text-sm border border-amber-200">
        <strong>⚠️ Importante — Prevenir Fuga de Dinero:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>El "Monto a Devolver" es lo que el cliente solicita de su saldo restante.</li>
          <li>En el dashboard de Whop, devuelve <strong>solo el monto indicado aquí</strong>, NO el total del pago original.</li>
          <li>Si el cliente usó parte de su depósito en llamadas, esas comisiones ya se repartieron y no se deben devolver.</li>
          <li>Tras devolver en Whop, haz clic en "Marcar Devuelto" para descontar el saldo en el sistema.</li>
        </ul>
      </div>
    </div>
  );
}
