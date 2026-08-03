"use client";

import * as React from "react";
import { Plus, Save, Trash2, Tag } from "lucide-react";
import { ApiClient, type RechargePackage } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function AdminTarifasSection() {
  const [paquetes, setPaquetes] = React.useState<RechargePackage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nuevoOpen, setNuevoOpen] = React.useState(false);
  const [nuevo, setNuevo] = React.useState({
    nombre: "",
    montoRecarga: "",
    saldoOtorgado: "",
    precioPorMinuto: "",
  });
  const [editando, setEditando] = React.useState<Record<number, Partial<RechargePackage>>>({});

  const cargar = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await ApiClient.get<{ paquetes: RechargePackage[] }>("/api/admin/packages");
      setPaquetes(data.paquetes);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async () => {
    try {
      await ApiClient.post("/api/admin/packages", {
        nombre: nuevo.nombre,
        montoRecarga: Number(nuevo.montoRecarga),
        saldoOtorgado: Number(nuevo.saldoOtorgado),
        precioPorMinuto: Number(nuevo.precioPorMinuto),
        activo: true,
      });
      toast.success("Paquete creado");
      setNuevoOpen(false);
      setNuevo({ nombre: "", montoRecarga: "", saldoOtorgado: "", precioPorMinuto: "" });
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const guardarEdicion = async (id: number) => {
    const cambios = { ...editando[id] };
    if (!cambios || Object.keys(cambios).length === 0) return;
    try {
      if (typeof cambios.montoRecarga === "string") cambios.montoRecarga = Number(cambios.montoRecarga);
      if (typeof cambios.saldoOtorgado === "string") cambios.saldoOtorgado = Number(cambios.saldoOtorgado);
      if (typeof cambios.precioPorMinuto === "string") cambios.precioPorMinuto = Number(cambios.precioPorMinuto);
      
      await ApiClient.patch("/api/admin/packages", { id, ...cambios });
      toast.success("Paquete actualizado");
      setEditando((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este paquete?")) return;
    try {
      await ApiClient.delete(`/api/admin/packages?id=${id}`);
      toast.success("Paquete eliminado");
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const toggleActivo = async (p: RechargePackage) => {
    try {
      await ApiClient.patch("/api/admin/packages", { id: p.id, activo: !p.activo });
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const setCambio = (id: number, campo: keyof RechargePackage, valor: string) => {
    setEditando((prev) => ({
      ...prev,
      [id]: { ...prev[id], [campo]: valor },
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="panel-wa">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" /> Paquetes de recarga
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Define los paquetes que los clientes pueden comprar. El precio por minuto se calcula automáticamente.
              </CardDescription>
            </div>
            <Button onClick={() => setNuevoOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nuevo paquete
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Pago cliente</TableHead>
                  <TableHead className="text-right">Saldo otorgado</TableHead>
                  <TableHead className="text-right">Precio/min</TableHead>
                  <TableHead className="text-right">Precio/seg</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paquetes.map((p) => {
                  const ed = editando[p.id] || {};
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Input
                          value={ed.nombre ?? p.nombre}
                          onChange={(e) => setCambio(p.id, "nombre", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={ed.montoRecarga ?? p.montoRecarga}
                          onChange={(e) => setCambio(p.id, "montoRecarga", e.target.value)}
                          className="h-8 text-sm w-24 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={ed.saldoOtorgado ?? p.saldoOtorgado}
                          onChange={(e) => setCambio(p.id, "saldoOtorgado", e.target.value)}
                          className="h-8 text-sm w-24 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          value={ed.precioPorMinuto ?? p.precioPorMinuto}
                          onChange={(e) => setCambio(p.id, "precioPorMinuto", e.target.value)}
                          className="h-8 text-sm w-24 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        ${(p.precioPorMinuto / 60).toFixed(5)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={p.activo}
                          onCheckedChange={() => toggleActivo(p)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editando[p.id] && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-emerald-600"
                              onClick={() => guardarEdicion(p.id)}
                            >
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => eliminar(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo paquete</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Paquete Premium"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto que paga (USD)</Label>
                <Input
                  type="number"
                  value={nuevo.montoRecarga}
                  onChange={(e) => setNuevo({ ...nuevo, montoRecarga: e.target.value })}
                  placeholder="25"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Saldo otorgado (USD)</Label>
                <Input
                  type="number"
                  value={nuevo.saldoOtorgado}
                  onChange={(e) => setNuevo({ ...nuevo, saldoOtorgado: e.target.value })}
                  placeholder="50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Precio por minuto (USD)</Label>
              <Input
                type="number"
                step="0.001"
                value={nuevo.precioPorMinuto}
                onChange={(e) => setNuevo({ ...nuevo, precioPorMinuto: e.target.value })}
                placeholder="0.40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevoOpen(false)}>Cancelar</Button>
            <Button onClick={crear} disabled={!nuevo.nombre || !nuevo.montoRecarga}>
              Crear paquete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
