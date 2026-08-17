"use client";

import * as React from "react";
import { useAppStore } from "@/lib/store";
import { ApiClient, type Usuario, type Wallet } from "@/lib/api";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { LoginScreen } from "@/components/app/login-screen";
import { DashboardSection } from "@/components/sections/dashboard";
import { CitasSection } from "@/components/sections/citas";
import { GananciasSection } from "@/components/sections/ganancias";
import { AfiliadoDashboardSection } from "@/components/sections/afiliado-dashboard";
import { InstalacionGate } from "./instalacion-gate";
import { ConfiguracionSection } from "@/components/sections/configuracion";
import { SimuladorSection } from "@/components/sections/simulador";
import { SalientesSection } from "@/components/sections/salientes";
import { AdminClientesSection } from "@/components/sections/admin-clientes";
import { AdminMetricasSection } from "@/components/sections/admin-metricas";
import { AdminFlujoSection } from "@/components/sections/admin-flujo";
import { AdminConfigSection } from "@/components/sections/admin-config";
import { AdminRankingSection } from "@/components/sections/admin-ranking";
import { AdminAfiliadosSection } from "@/components/sections/admin-afiliados";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "sonner";

export function AppShell() {
  const { usuario, setUsuario, seccion, walletVersion } = useAppStore();
  const [cargandoSesion, setCargandoSesion] = React.useState(true);
  const [walletSaldo, setWalletSaldo] = React.useState(0);
  const [porcentajeSaldo, setPorcentajeSaldo] = React.useState(100);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { eventos, conectado } = useSSE();
  const lastEventTs = React.useRef(0);

  // Cargar sesión al montar
  React.useEffect(() => {
    (async () => {
      try {
        const data = await ApiClient.get<{
          user: Usuario;
          wallet: Wallet | null;
        }>("/api/session");
        setUsuario(data.user);
        if (data.wallet) {
          setWalletSaldo(data.wallet.saldo);
        }
      } catch {
        // Sin sesión o sesión expirada — limpiar estado para mostrar login
        useAppStore.getState().logout();
      } finally {
        setCargandoSesion(false);
      }
    })();
  }, [setUsuario]);

  // Refrescar wallet cuando cambia el usuario, sección o walletVersion
  React.useEffect(() => {
    if (!usuario || usuario.role !== "cliente") return;
    ApiClient.get<{
      wallet: { saldo: number } | null;
      porcentajeSaldo: number;
    }>(`/api/wallet?userId=${usuario.id}`)
      .then((data) => {
        setWalletSaldo(data.wallet?.saldo ?? 0);
        setPorcentajeSaldo(data.porcentajeSaldo);
      })
      .catch(() => {
        setWalletSaldo(0);
        setPorcentajeSaldo(0);
      });
  }, [usuario, seccion, walletVersion]);

  // Mostrar toast en eventos SSE importantes
  React.useEffect(() => {
    if (eventos.length === 0) return;
    const ultimo = eventos[eventos.length - 1];
    if (ultimo.ts === lastEventTs.current) return;
    lastEventTs.current = ultimo.ts;

    const data = ultimo.data as Record<string, unknown>;
    switch (ultimo.tipo) {
      case "conexion_establecida":
        console.log("[SSE] Conectado al backend Express en tiempo real");
        break;
      case "nueva_cita":
        toast.success("📅 Nueva cita agendada por la IA");
        break;
      case "herramienta_usada": {
        const d = data as {
          name?: string;
          status?: string;
          args?: { customer_name?: string; date?: string; servicio?: string; start_time?: string };
          data?: { servicio?: string | null };
        };
        const nombre = d.name ?? "";
        const args = d.args ?? {};
        const ok = d.status === "ok";
        let texto = "";
        if (nombre === "agendar_cita" && ok) {
          const serv = d.data?.servicio || args.servicio;
          texto = `🛠️ IA agendó${serv ? ` ${serv}` : " cita"} para ${args.customer_name ?? ""}`.trim();
        } else if (nombre === "agendar_cita") {
          texto = `🛠️ IA intentó agendar para ${args.customer_name ?? "cliente"} (sin éxito)`;
        } else if (nombre === "consultar_disponibilidad") {
          texto = `🛠️ IA consultó disponibilidad para ${args.date ?? ""}`;
        } else if (nombre === "cancelar_cita") {
          texto = `🛠️ IA canceló cita de ${args.customer_name ?? "cliente"}`;
        }
        if (texto) ok ? toast.info(texto) : toast.warning(texto);
        break;
      }
      case "llamada_iniciada":
        toast.info("📞 Llamada entrante en curso");
        break;
      case "llamada_finalizada": {
        const d = data as { duracionSegundos?: number; costo?: number };
        toast.success(`✅ Llamada finalizada · ${d.duracionSegundos ?? 0}s · $${(d.costo ?? 0).toFixed(2)}`);
        break;
      }
      case "saldo_bajo":
        toast.warning("⚠️ Saldo bajo - considera recargar");
        break;
      case "alerta_sistema":
        toast.error("🚨 Alerta del sistema - revisa métricas");
        break;
      case "recarga_exitosa":
        toast.success("💰 Recarga acreditada");
        break;
    }
  }, [eventos]);

  if (cargandoSesion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <div className="inline-flex h-32 w-32 items-center justify-center rounded-full overflow-hidden animate-pulse border border-border/50 shadow-lg">
            <img src="/logotipo.png" alt="Voice IA Logo" className="h-full w-full object-cover" />
          </div>
          <div className="text-lg text-muted-foreground font-medium animate-pulse">Cargando Voice IA...</div>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <LoginScreen />;
  }

  if (usuario.role === "cliente" && !usuario.installationPaid && (usuario.installationAmount || 0) > 0) {
    return <InstalacionGate amount={usuario.installationAmount!} />;
  }

  const renderSeccion = () => {
    const esCliente = usuario.role === "cliente";
    switch (seccion) {
      case "dashboard":
        return esCliente ? <DashboardSection /> : <NoAccess />;
      case "citas":
        return esCliente ? <CitasSection /> : <NoAccess />;
      case "recargas":
        return esCliente ? <GananciasSection /> : <NoAccess />;
      case "configuracion":
        return esCliente ? <ConfiguracionSection /> : <NoAccess />;
      case "simulador":
        return esCliente ? <SimuladorSection /> : <NoAccess />;
      case "salientes":
        return esCliente ? <SalientesSection /> : <NoAccess />;
      case "admin-clientes":
        return usuario.role === "admin" ? <AdminClientesSection /> : <NoAccess />;

      case "admin-metricas":
        return usuario.role === "admin" ? <AdminMetricasSection /> : <NoAccess />;
      case "admin-flujo":
        return usuario.role === "admin" ? <AdminFlujoSection /> : <NoAccess />;
      case "admin-ranking":
        return usuario.role === "admin" ? <AdminRankingSection /> : <NoAccess />;
      case "admin-config":
        return usuario.role === "admin" ? <AdminConfigSection /> : <NoAccess />;
      case "admin-afiliados":
        return usuario.role === "admin" ? <AdminAfiliadosSection /> : <NoAccess />;
      case "afiliado-dashboard":
        return usuario.role === "afiliado" ? <AfiliadoDashboardSection /> : <NoAccess />;
      default:
        return esCliente ? <DashboardSection /> : <AdminMetricasSection />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar
          walletSaldo={walletSaldo}
          porcentajeSaldo={porcentajeSaldo}
        />
      </div>

      {/* Sidebar mobile (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 left-3 lg:hidden z-50"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72">
          <Sidebar
            walletSaldo={walletSaldo}
            porcentajeSaldo={porcentajeSaldo}
            onSeccionChange={() => setSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          sseConectado={conectado}
          walletSaldo={walletSaldo}
          porcentajeSaldo={porcentajeSaldo}
        />
        <main className="flex-1 overflow-y-auto wa-scroll p-4 lg:p-6 chat-bg" style={{ zoom: 0.70 }}>
          {renderSeccion()}
        </main>
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-lg font-semibold">Acceso denegado</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Necesitas permisos de administrador para ver esta sección.
        </p>
      </div>
    </div>
  );
}
