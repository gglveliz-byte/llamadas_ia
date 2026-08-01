"use client";

import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalletBalanceProps {
  saldo: number;
  porcentaje: number;
  onClick?: () => void;
  compact?: boolean;
}

export function WalletBalance({ saldo, porcentaje, onClick, compact }: WalletBalanceProps) {
  const color =
    porcentaje > 50
      ? "text-emerald-600 dark:text-emerald-400"
      : porcentaje > 20
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const barColor =
    porcentaje > 50
      ? "bg-emerald-500"
      : porcentaje > 20
        ? "bg-amber-500"
        : "bg-red-500";

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-lg p-3 bg-sidebar-accent/60 hover:bg-sidebar-accent transition-colors"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-medium">
            Saldo
          </span>
          <span className={cn("text-[10px] font-medium", color)}>
            {porcentaje.toFixed(0)}%
          </span>
        </div>
        <div className={cn("text-xl font-bold", color)}>
          ${Number(saldo).toFixed(2)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">USD · Click para recargar</div>
      </button>
    );
  }

  return (
    <div className="p-5" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Saldo actual
        </span>
        <Wallet className={cn("h-4 w-4", color)} />
      </div>
      <div className={cn("text-3xl font-bold", color)}>
        ${Number(saldo).toFixed(2)}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {porcentaje.toFixed(0)}% de la última recarga
      </div>
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(100, Math.max(5, porcentaje))}%` }}
        />
      </div>
    </div>
  );
}
