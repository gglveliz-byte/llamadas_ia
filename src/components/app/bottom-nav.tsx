"use client";

import * as React from "react";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Wallet, 
  Mic, 
  Settings 
} from "lucide-react";
import { useAppStore, type Seccion } from "@/lib/store";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  id: Seccion;
  label: string;
  icon: React.ComponentType<{ className?: string, strokeWidth?: number }>;
}

const CLIENT_ITEMS: BottomNavItem[] = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { id: "citas", label: "Citas", icon: CalendarDays },
  { id: "simulador", label: "Asistente", icon: Mic },
  { id: "recargas", label: "Saldo", icon: Wallet },
  { id: "configuracion", label: "Ajustes", icon: Settings },
];

export function BottomNav({ onSeccionChange }: { onSeccionChange?: () => void }) {
  const { usuario, seccion, setSeccion } = useAppStore();

  // Por ahora, solo mostramos la barra inferior para clientes
  if (usuario?.role !== "cliente") {
    return null;
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 pb-safe z-50 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)]">
      {CLIENT_ITEMS.map((item) => {
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
              "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all active:scale-95",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
                "p-1 rounded-full transition-all duration-200", 
                active ? "bg-primary/10 scale-110" : ""
            )}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            </div>
            <span className={cn("text-[10px] font-medium transition-all duration-200", active && "font-bold scale-105")}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
