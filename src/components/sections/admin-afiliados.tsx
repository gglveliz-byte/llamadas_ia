"use client";

import * as React from "react";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminAfiliadosSection() {
  const [loading, setLoading] = React.useState(true);
  const [afiliados, setAfiliados] = React.useState<any[]>([]);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [openEditDialog, setOpenEditDialog] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [afiliadoAEditar, setAfiliadoAEditar] = React.useState<any>(null);

  // Form state
  const [formData, setFormData] = React.useState({
    nombre: "",
    email: "",
    password: "",
    slug: "",
    comisionPorMinuto: 0.05,
    feeInstalacion: 100,
    gananciaInstalacion: 50,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/affiliate/admin/list`, {
        headers: {
          "x-user-role": "admin",
        }
      });
      if (res.ok) {
        const json = await res.json();
        setAfiliados(json);
      } else {
        toast.error("Error al cargar afiliados");
      }
    } catch (e) {
      console.error("Error fetching affiliates list", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    let finalSlug = formData.slug;
    if (!finalSlug && formData.email) {
      const base = formData.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const random = Math.floor(1000 + Math.random() * 9000);
      finalSlug = `${base}${random}`;
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/affiliate/admin/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
        },
        body: JSON.stringify({ ...formData, slug: finalSlug }),
      });

      if (res.ok) {
        toast.success("Afiliado creado correctamente");
        setOpenDialog(false);
        setFormData({ nombre: "", email: "", password: "", slug: "", comisionPorMinuto: 0.05, feeInstalacion: 100, gananciaInstalacion: 50 });
        fetchData(); // Recargar lista
      } else {
        const error = await res.json();
        toast.error(error.error || "Error al crear afiliado");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error de conexión");
    } finally {
      setCreating(false);
    }
  };

  const handleSuspender = async (id: string, currentStatus: boolean) => {
    if (!confirm(`¿Estás seguro de que deseas ${currentStatus ? 'suspender' : 'activar'} a este afiliado?`)) return;
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/affiliate/admin/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        toast.success(`Afiliado ${currentStatus ? 'suspendido' : 'activado'}`);
        fetchData();
      } else {
        toast.error("Error al actualizar afiliado");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este afiliado de forma permanente?")) return;
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/affiliate/admin/${id}`, {
        method: "DELETE",
        headers: {
          "x-user-role": "admin",
        },
      });
      if (res.ok) {
        toast.success("Afiliado eliminado");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar afiliado");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };

  const handleEdit = (afiliado: any) => {
    setAfiliadoAEditar(afiliado);
    setOpenEditDialog(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!afiliadoAEditar) return;
    setEditing(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/affiliate/admin/${afiliadoAEditar.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
        },
        body: JSON.stringify({
          comisionPorMinuto: Number(afiliadoAEditar.comisionPorMinuto),
          feeInstalacion: Number(afiliadoAEditar.feeInstalacion),
          porcentajeInstalacion: Number(afiliadoAEditar.porcentajeInstalacion),
        }),
      });

      if (res.ok) {
        toast.success("Afiliado actualizado correctamente");
        setOpenEditDialog(false);
        setAfiliadoAEditar(null);
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Error al actualizar afiliado");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error de conexión");
    } finally {
      setEditing(false);
    }
  };

  if (loading && afiliados.length === 0) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando afiliados...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Gestión de Afiliados
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra los afiliados que traen negocios a la plataforma.
          </p>
        </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Afiliado
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Afiliado</DialogTitle>
                <DialogDescription>
                  Ingresa los datos para registrar un nuevo afiliado en el sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input 
                    id="nombre" 
                    required 
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña temporal</Label>
                  <Input 
                    id="password" 
                    type="text" 
                    required 
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="comisionPorMinuto">Comisión / min ($)</Label>
                    <Input 
                      id="comisionPorMinuto" 
                      type="number" 
                      step="0.01" 
                      required 
                      value={formData.comisionPorMinuto}
                      onChange={(e) => setFormData({ ...formData, comisionPorMinuto: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="feeInstalacion">Fee Instalación ($)</Label>
                    <Input 
                      id="feeInstalacion" 
                      type="number" 
                      step="1" 
                      required 
                      value={formData.feeInstalacion}
                      onChange={(e) => setFormData({ ...formData, feeInstalacion: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gananciaInstalacion">Ganancia Afiliado ($)</Label>
                    <Input 
                      id="gananciaInstalacion" 
                      type="number" 
                      step="1" 
                      min="0"
                      required 
                      value={formData.gananciaInstalacion}
                      onChange={(e) => setFormData({ ...formData, gananciaInstalacion: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creando..." : "Crear Afiliado"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Diálogo para Editar Afiliado */}
        <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
          <DialogContent>
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Editar Comisiones de Afiliado</DialogTitle>
                <DialogDescription>
                  Actualiza la comisión por minuto o la cuota de instalación para {afiliadoAEditar?.nombre}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-comision">Comisión / min ($)</Label>
                    <Input 
                      id="edit-comision" 
                      type="number" 
                      step="0.01" 
                      required 
                      value={afiliadoAEditar?.comisionPorMinuto || 0}
                      onChange={(e) => setAfiliadoAEditar({ ...afiliadoAEditar, comisionPorMinuto: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-fee">Fee Instalación ($)</Label>
                    <Input 
                      id="edit-fee" 
                      type="number" 
                      step="1" 
                      required 
                      value={afiliadoAEditar?.feeInstalacion || 0}
                      onChange={(e) => setAfiliadoAEditar({ ...afiliadoAEditar, feeInstalacion: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-ganancia">Ganancia Afiliado ($)</Label>
                    <Input 
                      id="edit-ganancia" 
                      type="number" 
                      step="1" 
                      min="0"
                      required 
                      value={afiliadoAEditar?.gananciaInstalacion || 50}
                      onChange={(e) => setAfiliadoAEditar({ ...afiliadoAEditar, gananciaInstalacion: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpenEditDialog(false); setAfiliadoAEditar(null); }}>Cancelar</Button>
                <Button type="submit" disabled={editing}>
                  {editing ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Lista de Afiliados Activos
          </CardTitle>
          <CardDescription>
            Tienen acceso a su propio panel y ganan comisiones por referido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {afiliados.map((afiliado: any) => (
                <div key={afiliado.id} className="flex flex-col md:flex-row justify-between md:items-center p-4 rounded-xl border border-border bg-card hover:bg-secondary/20 transition-colors gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-lg flex items-center gap-2">
                      {afiliado.nombre}
                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-xs">
                        {afiliado.negociosRef} negocios
                      </Badge>
                      {!afiliado.isActive && (
                        <Badge variant="destructive" className="text-xs">Suspendido</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{afiliado.email}</div>
                    <div className="text-xs text-muted-foreground">URL: voz.ia/register?ref={afiliado.slug}</div>
                    {afiliado.ultimoReferidoAt && (
                      <div className="text-xs mt-1">
                        Último referido: {new Date(afiliado.ultimoReferidoAt).toLocaleDateString()}
                      </div>
                    )}
                    {(!afiliado.ultimoReferidoAt || (Date.now() - new Date(afiliado.ultimoReferidoAt).getTime() > 90 * 24 * 60 * 60 * 1000)) && afiliado.createdAt && (Date.now() - new Date(afiliado.createdAt).getTime() > 90 * 24 * 60 * 60 * 1000) && (
                      <Badge variant="destructive" className="mt-2 text-[10px]">
                        ⚠️ Inactivo {'>'} 90 días
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="font-semibold">${afiliado.comisionPorMinuto}/min</div>
                      <div className="text-xs text-muted-foreground uppercase">Comisión Fija</div>
                    </div>
                    <div>
                      <div className="font-semibold">${afiliado.feeInstalacion || "0.00"} <span className="text-[10px] text-muted-foreground font-normal">(${afiliado.gananciaInstalacion || 50})</span></div>
                      <div className="text-xs text-muted-foreground uppercase">Instalación</div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleEdit(afiliado)}>
                      Editar
                    </Button>
                    <Button 
                      variant={afiliado.isActive ? "destructive" : "secondary"} 
                      size="sm" 
                      onClick={() => handleSuspender(afiliado.id, afiliado.isActive)}
                      className={afiliado.isActive ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" : ""}
                    >
                      {afiliado.isActive ? "Suspender" : "Activar"}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleEliminar(afiliado.id)}
                      className="bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
              
              {afiliados.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No hay afiliados registrados.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
