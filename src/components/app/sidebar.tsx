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
  Trophy,
  Cog,
  Moon,
  Sun,
  LogOut,
  ChevronDown,
  Phone,
  PhoneOutgoing,
} from "lucide-react";
import { useAppStore, type Seccion } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WalletBalance } from "@/components/billing/WalletBalance";
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
  rol: "cliente" | "admin";
}

const NAV_ITEMS: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, rol: "cliente" },
  { id: "citas", label: "Citas", icon: CalendarDays, rol: "cliente" },
  { id: "recargas", label: "Recargas", icon: Wallet, rol: "cliente" },
  { id: "simulador", label: "Configuración del Negocio", icon: Mic, rol: "cliente" },
  { id: "salientes", label: "Llamar", icon: PhoneOutgoing, rol: "cliente" },
  { id: "configuracion", label: "Configuración", icon: Settings, rol: "cliente" },
  { id: "admin-clientes", label: "Clientes", icon: Users, rol: "admin" },
  { id: "admin-tarifas", label: "Tarifas", icon: Tag, rol: "admin" },
  { id: "admin-metricas", label: "Métricas", icon: Activity, rol: "admin" },
  { id: "admin-flujo", label: "Flujo de Caja", icon: TrendingUp, rol: "admin" },
  { id: "admin-ranking", label: "Ranking", icon: Trophy, rol: "admin" },
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

  const items = NAV_ITEMS.filter((item) => item.rol === usuario?.role);

  const initials = (usuario?.businessName || usuario?.email || "")
    .slice(0, 2)
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
            Asistente de voz con IA
          </span>
        </div>
      </div>

      {usuario?.role === "cliente" && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <WalletBalance
            saldo={walletSaldo}
            porcentaje={porcentajeSaldo}
            compact
            onClick={() => {
              setSeccion("recargas");
              onSeccionChange?.();
            }}
          />
        </div>
      )}

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
            {usuario?.role === "cliente" ? (
              <>
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
              </>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  setSeccion("admin-config");
                  onSeccionChange?.();
                }}
              >
                <Cog className="h-4 w-4 mr-2" /> Configuración Admin
              </DropdownMenuItem>
            )}
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
