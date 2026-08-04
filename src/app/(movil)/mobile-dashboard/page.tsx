"use client";

import * as React from "react";
import Link from "next/link";
import { Wallet, Phone, Calendar, Settings, MessageSquare } from "lucide-react";
import { ApiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function MobileDashboardPage() {
  const [usuario, setUsuario] = React.useState<{ id: string; businessName?: string } | null>(null);
  const [saldo, setSaldo] = React.useState(0);
  const [citas, setCitas] = React.useState(0);

  React.useEffect(() => {
    ApiClient.get<{ user: { id: string; businessName?: string } }>("/api/session")
      .then((d) => {
        setUsuario(d.user);
        return d.user.id;
      })
      .then((userId) =>
        ApiClient.get<{ wallet: { saldo: number } | null }>(`/api/wallet?userId=${userId}`)
      )
      .then((d) => setSaldo(d.wallet?.saldo ?? 0))
      .catch(() => {});
    ApiClient.get<{ total: number }>("/api/appointments?limit=1")
      .then((d) => setCitas(d.total || 0))
      .catch(() => {});
  }, []);

  const items = [
    { icon: Wallet, label: "Saldo", value: `$${saldo.toFixed(2)}`, href: "/" },
    { icon: Calendar, label: "Citas", value: `${citas}`, href: "/" },
    { icon: MessageSquare, label: "Configurador", value: "Entrevista IA", href: "/simulador" },
    { icon: Settings, label: "Configuración", value: "Ajustes", href: "/mobile-configuracion" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0b141a]">
      <header className="px-4 py-4 border-b border-white/10 bg-white/80 dark:bg-[#1f2c33]/80 backdrop-blur-sm">
        <h1 className="text-lg font-bold">{usuario?.businessName ?? "VozIA"}</h1>
        <p className="text-xs text-muted-foreground">Panel móvil</p>
      </header>

      <div className="flex-1 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="bg-white dark:bg-[#1f2c33] rounded-xl p-4 border border-slate-200 dark:border-white/[0.08] active:scale-95 transition-transform"
            >
              <item.icon className="h-5 w-5 text-primary mb-2" />
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="text-sm font-bold">{item.value}</div>
            </Link>
          ))}
        </div>

        <div className="bg-white dark:bg-[#1f2c33] rounded-xl p-4 border border-slate-200 dark:border-white/[0.08] mt-2">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Acceso rápido
          </h2>
          <Link
            href="/simulador"
            className="block w-full py-3 px-4 bg-primary/10 rounded-lg text-sm font-medium text-primary text-center"
          >
            Abrir Configuración del Negocio
          </Link>
        </div>
      </div>
    </div>
  );
}
