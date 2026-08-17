import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { ApiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Loader2, Rocket, PhoneCall, Bot, Zap } from "lucide-react";

export function InstalacionGate({ amount }: { amount: number }) {
  const { usuario } = useAppStore();
  const [cargando, setCargando] = useState(false);

  const handlePagar = async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      // Usamos el endpoint publico en el backend express directamente
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/public/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: usuario.id,
          tipo: "instalacion",
        })
      });
      
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error("No se pudo generar el link de pago.");
        setCargando(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Error al intentar generar el pago.");
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Izquierda: Información de la plataforma */}
        <div className="p-8 md:p-10 bg-slate-900 text-white flex flex-col justify-center relative overflow-hidden">
          {/* Decorative background circle */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-slate-800 opacity-50 blur-3xl"></div>
          
          <div className="relative z-10 space-y-6">
            <div>
              <img src="/logotipo.png" alt="Voice IA" className="w-16 h-16 rounded-full bg-white p-1 mb-4 shadow-md object-cover" />
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Tu Agente de Voz IA</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Estás a un paso de activar tu recepcionista inteligente 24/7.
              </p>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-slate-700/50">
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-blue-500/20 p-2 rounded-lg text-blue-400">
                  <PhoneCall size={18} />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-slate-100">Atención sin límites</h4>
                  <p className="text-xs text-slate-400">Tu IA contesta llamadas, agenda citas y atiende clientes sin cansarse.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                  <Bot size={18} />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-slate-100">Integración con tu negocio</h4>
                  <p className="text-xs text-slate-400">Configura tus horarios, servicios y respuestas predefinidas.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-amber-500/20 p-2 rounded-lg text-amber-400">
                  <Zap size={18} />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-slate-100">Aumento de conversiones</h4>
                  <p className="text-xs text-slate-400">No pierdas ningún cliente por no poder contestar el teléfono.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Derecha: Pago de Instalación */}
        <div className="p-8 md:p-10 flex flex-col justify-center bg-white relative">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Completar Activación</h3>
            <p className="text-sm text-slate-500">
              Para desbloquear tu panel y comenzar a configurar tu agente, es necesario realizar el pago de instalación de la plataforma.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 font-medium">Cuota de instalación única</span>
              <span className="text-2xl font-bold text-slate-900">${amount.toFixed(2)}</span>
            </div>
            <p className="text-xs text-slate-500">USD, pago único y sin plazos forzosos.</p>
          </div>

          <Button
            onClick={handlePagar}
            disabled={cargando}
            className="w-full h-12 text-base font-medium shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
          >
            {cargando ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <CreditCard className="w-5 h-5 mr-2" />
            )}
            {cargando ? "Redirigiendo..." : "Pagar y Activar"}
          </Button>

          <p className="text-xs text-center text-slate-400 mt-6 flex items-center justify-center gap-1">
            <Rocket size={12} />
            Acceso inmediato tras el pago
          </p>
        </div>
      </div>
    </div>
  );
}
