"use client";

import * as React from "react";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore, type Seccion } from "@/lib/store";
import { ApiClient, type Notification } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { WalletBalance } from "@/components/billing/WalletBalance";

const TITULOS: Record<Seccion, string> = {
  dashboard: "Dashboard",
  citas: "Citas",
  recargas: "Recargas y Wallet",
  configuracion: "Configuración",
  simulador: "Configuración del Negocio",
  "admin-clientes": "Admin · Clientes",
  "admin-tarifas": "Admin · Tarifas",
  "admin-metricas": "Admin · Métricas del Sistema",
  "admin-flujo": "Admin · Flujo de Caja",
  "admin-ranking": "Admin · Ranking",
  "admin-config": "Admin · Configuración Global",
};

export function Topbar({
  onMenuClick,
  sseConectado,
  walletSaldo,
  porcentajeSaldo,
}: {
  onMenuClick?: () => void;
  sseConectado?: boolean;
  walletSaldo?: number;
  porcentajeSaldo?: number;
}) {
  const { usuario, seccion, setSeccion } = useAppStore();
  const [notifs, setNotifs] = React.useState<Notification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  const cargarNotifs = React.useCallback(async () => {
    if (!usuario) return;
    try {
      const data = await ApiClient.get<{ notifications: Notification[]; unreadCount: number }>(
        `/api/notifications?userId=${usuario.id}`
      );
      setNotifs(data.notifications);
      setUnread(data.unreadCount);
    } catch {}
  }, [usuario]);

  React.useEffect(() => {
    cargarNotifs();
    const interval = setInterval(cargarNotifs, 30000);
    return () => clearInterval(interval);
  }, [cargarNotifs]);

  const marcarLeidas = async () => {
    if (!usuario) return;
    await ApiClient.post("/api/notifications", { userId: usuario.id });
    setUnread(0);
    setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold">{TITULOS[seccion]}</h1>
        {usuario?.role === "admin" && seccion.startsWith("admin") && (
          <Badge variant="default" className="bg-amber-600 text-white">
            Admin
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {usuario?.role === "cliente" && walletSaldo !== undefined && (
          <button
            onClick={() => setSeccion("recargas")}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <span className="text-sm font-bold">${Number(walletSaldo).toFixed(2)}</span>
          </button>
        )}
        {sseConectado !== undefined && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium"
            title={sseConectado ? "En línea" : "Sin conexión"}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                sseConectado ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              )}
            />
            <span className={cn(sseConectado ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
              {sseConectado ? "Live" : "Offline"}
            </span>
          </div>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-sm font-semibold">Notificaciones</span>
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={marcarLeidas}
                >
                  Marcar todas leídas
                </Button>
              )}
            </div>
            <ScrollArea className="h-80">
              {notifs.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No tienes notificaciones
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifs.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "p-3 hover:bg-muted/50 cursor-default",
                        !n.leida && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{n.titulo}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {n.mensaje}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </div>
                        </div>
                        {!n.leida && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
