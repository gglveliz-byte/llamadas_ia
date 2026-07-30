"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Settings,
  Mic,
  Users,
  Tag,
  Activity,
  TrendingUp,
  Cog,
  Moon,
  Sun,
  LogOut,
  ChevronDown,
  Phone,
} from "lucide-react";
import { useAppStore, type Seccion } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SidebarItem {
  id: Seccion;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  rol: "cliente" | "admin" | "ambos";
}

const NAV_ITEMS: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, rol: "ambos" },
  { id: "citas", label: "Citas", icon: CalendarDays, rol: "ambos" },
  { id: "recargas", label: "Recargas", icon: Wallet, rol: "ambos" },
  { id: "simulador", label: "Simulador de Voz", icon: Mic, rol: "ambos" },
  { id: "configuracion", label: "Configuración", icon: Settings, rol: "ambos" },
  { id: "admin-clientes", label: "Clientes", icon: Users, rol: "admin" },
  { id: "admin-tarifas", label: "Tarifas", icon: Tag, rol: "admin" },
  { id: "admin-metricas", label: "Métricas", icon: Activity, rol: "admin" },
  { id: "admin-flujo", label: "Flujo de Caja", icon: TrendingUp, rol: "admin" },
  { id: "admin-config", label: "Configuración Admin", icon: Cog, rol: "admin" },
];

interface SidebarProps {
  walletSaldo: number;
  porcentajeSaldo: number;
  onSeccionChange?: () => void;
}

export function Sidebar({ walletSaldo, porcentajeSaldo, onSeccionChange }: SidebarProps) {
  const { usuario, seccion, setSeccion, logout } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const items = NAV_ITEMS.filter(
    (item) => item.rol === "ambos" || item.rol === usuario?.role
  );

  const colorSaldo =
    porcentajeSaldo > 50
      ? "text-emerald-600 dark:text-emerald-400"
      : porcentajeSaldo > 20
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  const initials = (usuario?.businessName || usuario?.email || "??")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
          <Phone className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-sidebar-foreground leading-tight">
            VozIA
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Voice AI SaaS
          </span>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-sidebar-border">
        <button
          onClick={() => {
            setSeccion("recargas");
            onSeccionChange?.();
          }}
          className="w-full text-left rounded-lg p-3 bg-sidebar-accent/60 hover:bg-sidebar-accent transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-medium">
              Saldo
            </span>
            <Badge variant="outline" className={cn("text-[10px] h-4 px-1", colorSaldo)}>
              {porcentajeSaldo.toFixed(0)}%
            </Badge>
          </div>
          <div className={cn("text-xl font-bold", colorSaldo)}>
            ${walletSaldo.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">USD · Click para recargar</div>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto wa-scroll px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = seccion === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setSeccion(item.id);
                onSeccionChange?.();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-4 w-4 mr-3" />
          ) : (
            <Moon className="h-4 w-4 mr-3" />
          )}
          {mounted ? (theme === "dark" ? "Modo claro" : "Modo oscuro") : "Tema"}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-semibold text-sidebar-foreground truncate">
                  {usuario?.businessName || usuario?.email}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {usuario?.role === "admin" ? "Administrador" : "Cliente"}
                </div>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {usuario?.businessName || "Usuario"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {usuario?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setSeccion("configuracion");
                onSeccionChange?.();
              }}
            >
              <Settings className="h-4 w-4 mr-2" /> Configuración
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSeccion("recargas");
                onSeccionChange?.();
              }}
            >
              <Wallet className="h-4 w-4 mr-2" /> Mi saldo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
