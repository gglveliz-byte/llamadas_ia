"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, CheckCircle2, User, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function RegistroAfiliadosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: "",
  });
  const [config, setConfig] = useState({
    comisionPorMinuto: 0.05,
    gananciaInstalacion: 50,
  });

  // Fetch config on mount
  useEffect(() => {
    fetch(`/api/affiliate/public/config`)
      .then(res => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(data => {
        if (data.comisionPorMinuto !== undefined) {
          setConfig({
            comisionPorMinuto: data.comisionPorMinuto,
            gananciaInstalacion: data.gananciaInstalacion,
          });
        }
      })
      .catch(err => console.error("Error fetching config", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/affiliate/public/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al registrar");
      }

      setSuccess(true);
      toast.success("¡Registro exitoso! Bienvenido al programa de afiliados.");
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/");
      }, 3000);
      
    } catch (err: any) {
      toast.error(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Registro Completado!</h2>
            <p className="text-slate-600 mb-8">
              Tu cuenta de afiliado ha sido creada con éxito. Ahora serás redirigido a la pantalla de inicio de sesión.
            </p>
            <Button onClick={() => router.push("/")} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Ir al Inicio de Sesión <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl grid md:grid-cols-2 gap-8 md:gap-4 items-center">
        {/* Lado Izquierdo: Beneficios */}
        <div className="flex flex-col justify-center px-2 md:px-0 mb-2 md:mb-0 text-center md:text-left">
          <div className="inline-flex items-center space-x-2 mb-3 justify-center md:justify-start">
            <div className="h-12 w-12 md:h-10 md:w-10 rounded-full overflow-hidden shadow-sm border border-border/50 bg-white">
              <img src="/logotipo.png" alt="Voice IA Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-xl md:text-lg font-bold tracking-tight text-slate-900">Voice IA Afiliados</span>
          </div>
          
          <h1 className="text-2xl md:text-xl lg:text-2xl font-extrabold text-slate-900 mb-2 leading-tight">
            Únete a nuestro programa y <span className="text-blue-600">genera ingresos pasivos</span>
          </h1>
          
          <p className="text-sm md:text-xs lg:text-sm text-slate-600 mb-6 md:mb-4">
            Recomienda la plataforma de inteligencia artificial más avanzada para atención telefónica y gana comisiones recurrentes por cada cliente.
          </p>

          <div className="space-y-5 md:space-y-4 text-left">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 md:w-7 md:h-7 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm md:text-xs mt-0.5">
                ${config.gananciaInstalacion}
              </div>
              <div className="ml-3 md:ml-2">
                <h3 className="text-base md:text-sm font-semibold text-slate-900">Ganancia por Instalación</h3>
                <p className="text-sm md:text-xs text-slate-600">Lleva ${config.gananciaInstalacion} garantizados por cada negocio que instale nuestra IA.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 md:w-7 md:h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm md:text-xs mt-0.5">
                {config.comisionPorMinuto * 100}¢
              </div>
              <div className="ml-3 md:ml-2">
                <h3 className="text-base md:text-sm font-semibold text-slate-900">Comisión por Minuto</h3>
                <p className="text-sm md:text-xs text-slate-600">Gana ${config.comisionPorMinuto} cada vez que tus clientes hablen por teléfono.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Formulario */}
        <Card className="border-0 shadow-lg overflow-hidden w-full max-w-md mx-auto md:max-w-sm md:ml-auto">
          <div className="h-1.5 md:h-1 bg-blue-600 w-full" />
          <CardHeader className="pt-6 pb-4 md:pt-5 md:pb-2 text-center">
            <CardTitle className="text-xl md:text-lg font-bold">Crear Cuenta</CardTitle>
            <CardDescription className="text-sm md:text-xs mt-1 md:mt-0.5">
              Regístrate gratis y obtén tu enlace.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 md:px-5 md:pb-5">
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-3">
              <div className="space-y-1.5 md:space-y-1">
                <label className="text-xs md:text-[11px] font-medium text-slate-700">Nombre Completo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 md:pl-2.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 md:h-3.5 md:w-3.5 text-slate-400" />
                  </div>
                  <Input
                    required
                    placeholder="Ej. Juan Pérez"
                    className="pl-9 h-11 md:h-9 text-sm md:text-xs bg-slate-50 border-slate-200"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-1">
                <label className="text-xs md:text-[11px] font-medium text-slate-700">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 md:pl-2.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 md:h-3.5 md:w-3.5 text-slate-400" />
                  </div>
                  <Input
                    required
                    type="email"
                    placeholder="tu@correo.com"
                    className="pl-9 h-11 md:h-9 text-sm md:text-xs bg-slate-50 border-slate-200"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-1">
                <label className="text-xs md:text-[11px] font-medium text-slate-700">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 md:pl-2.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 md:h-3.5 md:w-3.5 text-slate-400" />
                  </div>
                  <Input
                    required
                    type="password"
                    placeholder="••••••••"
                    minLength={6}
                    className="pl-9 h-11 md:h-9 text-sm md:text-xs bg-slate-50 border-slate-200"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <p className="text-[11px] md:text-[9px] text-slate-500 mt-1 md:mt-0.5">Mínimo 6 caracteres.</p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 md:h-9 mt-2 md:mt-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm md:text-xs"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Registrarme Gratis"
                )}
              </Button>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-slate-600">
                ¿Ya tienes una cuenta?{" "}
                <button
                  onClick={() => router.push("/")}
                  className="text-blue-600 font-semibold hover:underline"
                  type="button"
                >
                  Inicia sesión aquí
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
