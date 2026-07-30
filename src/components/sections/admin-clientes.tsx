"use client";

import * as React from "react";
import {
  Users,
  Search,
  Ban,
  CheckCircle,
  Trash2,
  DollarSign,
  Phone,
  Mail,
  MoreVertical,
  Plus,
  Minus,
} from "lucide-react";
import { ApiClient, type ClienteAdmin } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AdminClientesSection() {
  const [clientes, setClientes] = React.useState<ClienteAdmin[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busqueda, setBusqueda] = React.useState("");
  const [ajusteOpen, setAjusteOpen] = React.useState(false);
  const [clienteSel, setClienteSel] = React.useState<ClienteAdmin | null>(null);
  const [ajuste, setAjuste] = React.useState({ monto: "", descripcion: "" });

  const cargar = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await ApiClient.get<{ clientes: ClienteAdmin[] }>("/api/admin/clients");
      setClientes(data.clientes);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (clientId: string, action: "suspend" | "activate" | "delete") => {
    try {
      await ApiClient.patch("/api/admin/clients", { clientId, action });
      toast.success(
        action === "suspend" ? "Cliente suspendido" :
        action === "activate" ? "Cliente activado" :
        "Cliente eliminado"
      );
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const aplicarAjuste = async () => {
    if (!clienteSel) return;
    try {
      await ApiClient.post("/api/admin/clients", {
        clientId: clienteSel.id,
        monto: parseFloat(ajuste.monto),
        descripcion: ajuste.descripcion,
      });
      toast.success("Saldo ajustado");
      setAjusteOpen(false);
      setAjuste({ monto: "", descripcion: "" });
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const filtrados = clientes.filter(
    (c) =>
      c.businessName.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.email.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totales = {
    clientes: clientes.length,
    suspendidos: clientes.filter((c) => c.isSuspended).length,
    saldoTotal: clientes.reduce((s, c) => s + c.saldo, 0),
    recargadoTotal: clientes.reduce((s, c) => s + c.totalRecargado, 0),
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="panel-wa">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase font-medium">Clientes</div>
            <div className="text-2xl font-bold mt-1">{totales.clientes}</div>
          </CardContent>
        </Card>
        <Card className="panel-wa">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase font-medium">Suspendidos</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{totales.suspendidos}</div>
          </CardContent>
        </Card>
        <Card className="panel-wa">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase font-medium">Saldo total</div>
            <div className="text-2xl font-bold mt-1">${totales.saldoTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="panel-wa">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase font-medium">Recargado</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">${totales.recargadoTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="panel-wa">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Clientes
            </CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Recargado</TableHead>
                  <TableHead className="text-right">Consumido</TableHead>
                  <TableHead className="text-right">Llamadas</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-semibold text-sm">{c.businessName}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.aiLanguage.toUpperCase()} · {c.timezone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" /> {c.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Hace {formatDistanceToNow(new Date(c.createdAt), { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      ${c.saldo.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      ${c.totalRecargado.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-600">
                      ${c.totalDebitado.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.totalLlamadas}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.minutosLlamada}</TableCell>
                    <TableCell>
                      {c.isSuspended ? (
                        <Badge variant="destructive" className="text-[10px]">Suspendido</Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px] bg-emerald-600">Activo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setClienteSel(c);
                              setAjusteOpen(true);
                            }}
                          >
                            <DollarSign className="h-3.5 w-3.5 mr-2" /> Ajustar saldo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {c.isSuspended ? (
                            <DropdownMenuItem onClick={() => accion(c.id, "activate")}>
                              <CheckCircle className="h-3.5 w-3.5 mr-2" /> Activar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => accion(c.id, "suspend")}>
                              <Ban className="h-3.5 w-3.5 mr-2" /> Suspender
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm(`¿Eliminar a ${c.businessName}? Esta acción no se puede deshacer.`)) {
                                accion(c.id, "delete");
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                      No se encontraron clientes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal ajuste de saldo */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar saldo</DialogTitle>
            <DialogDescription>
              {clienteSel?.businessName} · Saldo actual: ${clienteSel?.saldo.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAjuste({ ...ajuste, monto: "10" })}
              >
                <Plus className="h-3 w-3 mr-1" /> +$10
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAjuste({ ...ajuste, monto: "-5" })}
              >
                <Minus className="h-3 w-3 mr-1" /> -$5
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Monto (positivo o negativo)</Label>
              <Input
                type="number"
                step="0.01"
                value={ajuste.monto}
                onChange={(e) => setAjuste({ ...ajuste, monto: e.target.value })}
                placeholder="10.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input
                value={ajuste.descripcion}
                onChange={(e) => setAjuste({ ...ajuste, descripcion: e.target.value })}
                placeholder="Compensación por error de facturación"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjusteOpen(false)}>Cancelar</Button>
            <Button onClick={aplicarAjuste} disabled={!ajuste.monto}>
              Aplicar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
