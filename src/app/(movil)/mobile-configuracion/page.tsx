"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Globe, Clock, User } from "lucide-react";
import { ApiClient } from "@/lib/api";

export default function MobileConfigPage() {
  const [usuario, setUsuario] = React.useState<{ businessName?: string; email?: string } | null>(null);

  React.useEffect(() => {
    ApiClient.get<{ user: { businessName?: string; email?: string } }>("/api/session")
      .then((d) => setUsuario(d.user))
      .catch(() => {});
  }, []);

  const items = [
    { icon: MessageSquare, label: "Simulador de Voz", desc: "Entrevista con IA", href: "/simulador" },
    { icon: Globe, label: "Idioma", desc: "Configurar idioma de la IA", href: "/" },
    { icon: Clock, label: "Horarios", desc: "Horario de atención", href: "/" },
    { icon: User, label: "Perfil", desc: usuario?.email ?? "Datos del negocio", href: "/" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0b141a]">
      <header className="px-4 py-4 border-b border-white/10 bg-white/80 dark:bg-[#1f2c33]/80 backdrop-blur-sm flex items-center gap-3">
        <Link href="/mobile-dashboard" className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Configuración</h1>
          <p className="text-xs text-muted-foreground">{usuario?.businessName ?? "VozIA"}</p>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-2">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-4 bg-white dark:bg-[#1f2c33] rounded-xl p-4 border border-slate-200 dark:border-white/[0.08] active:scale-[0.98] transition-transform"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
