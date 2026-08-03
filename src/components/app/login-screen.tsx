"use client";

import * as React from "react";
import { Phone, Mail, Shield, ArrowRight, Sparkles, Lock, UserPlus, LogIn, AlertCircle, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient, type Usuario } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Eliminado interface UsuarioDemo
export function LoginScreen() {
  const { setUsuario, setTokens, setSeccion } = useAppStore();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [modo, setModo] = React.useState<"login" | "register">("login");
  const [businessName, setBusinessName] = React.useState("");
  const [forgotModalOpen, setForgotModalOpen] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [forgotLoading, setForgotLoading] = React.useState(false);

  React.useEffect(() => {
    // Check URL params for verification status
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get("verificado") === "ok") {
        toast.success("Tu cuenta ha sido verificada correctamente. Ya puedes iniciar sesión.");
        // Clean URL to prevent showing toast again on reload
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get("error") === "token_requerido") {
        toast.error("El enlace de verificación no es válido.");
      } else if (params.get("error") === "token_invalido") {
        toast.error("El enlace de verificación ha expirado o es incorrecto.");
      } else if (params.get("error") === "ya_verificado") {
        toast.info("Tu cuenta ya estaba verificada.");
      }
    }
  }, []);

  const resendVerification = async (emailToResend: string) => {
    try {
      setLoading(true);
      await ApiClient.post<{ mensaje: string }>("/api/auth/resend-verification", { email: emailToResend });
      toast.success("Enlace reenviado. Revisa tu bandeja de entrada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loginReal = async () => {
    if (!email || !password) {
      toast.error("Ingresa email y contraseña");
      return;
    }
    setLoading(true);
    try {
      const res = await ApiClient.post<{
        user: Usuario;
        token: string;
        refreshToken: string;
      }>("/api/auth/login", { email, password });
      setUsuario(res.user);
      setTokens(res.token, res.refreshToken);
      setSeccion(res.user.role === "admin" ? "admin-metricas" : "dashboard");
      toast.success(`Bienvenido, ${res.user.businessName || res.user.email}`);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "Cuenta no verificada. Revisa tu email.") {
        toast.error(msg, {
          action: {
            label: "Reenviar correo",
            onClick: () => resendVerification(email)
          },
          duration: 10000,
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async () => {
    if (!email || !password) {
      toast.error("Ingresa email y contraseña");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await ApiClient.post<{
        mensaje: string;
      }>("/api/auth/register", { email, password, businessName: businessName || undefined });
      toast.success("Cuenta creada. Revisa tu email para verificarla.");
      setPassword("");
      setModo("login");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Eliminado loginDemo

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast.error("Ingresa tu email");
      return;
    }
    setForgotLoading(true);
    try {
      await ApiClient.post("/api/auth/forgot-password", { email: forgotEmail });
      toast.success("Si el email existe, recibirás instrucciones para restablecer tu contraseña");
      setForgotModalOpen(false);
      setForgotEmail("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background chat-bg p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 rounded-full bg-primary items-center justify-center shadow-lg">
            <Phone className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VozIA</h1>
            <p className="text-sm text-muted-foreground">
              Asistente de voz con IA para tu negocio
            </p>
          </div>
        </div>

        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@negocio.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-xs text-primary hover:underline self-end"
              >
                ¿Olvidé contraseña?
              </button>
            </div>
            {modo === "register" && (
              <div className="space-y-2">
                <Label htmlFor="businessName">Nombre del negocio (opcional)</Label>
                <Input
                  id="businessName"
                  placeholder="Mi Negocio"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
            )}

            {modo === "login" ? (
              <Button
                className="w-full"
                onClick={loginReal}
                disabled={loading || !email || !password}
              >
                {loading ? "Cargando..." : "Entrar"}
                <LogIn className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={register}
                disabled={loading || !email || !password}
              >
                {loading ? "Creando cuenta..." : "Crear cuenta"}
                <UserPlus className="h-4 w-4 ml-2" />
              </Button>
            )}

            <div className="text-center">
              <button
                onClick={() => setModo(modo === "login" ? "register" : "login")}
                className="text-xs text-primary hover:underline"
              >
                {modo === "login"
                  ? "¿No tienes cuenta? Regístrate"
                  : "¿Ya tienes cuenta? Inicia sesión"}
              </button>
            </div>

            {/* Eliminado sección demo */}
           </CardContent>
         </Card>
       </div>

       {/* Modal Recuperar Contraseña */}
       {forgotModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
           <div className="w-full max-w-md bg-card rounded-xl shadow-xl p-6 space-y-4">
             <div className="flex items-center justify-between">
               <h3 className="text-lg font-semibold">Recuperar contraseña</h3>
               <button
                 onClick={() => { setForgotModalOpen(false); setForgotEmail(""); }}
                 className="text-muted-foreground hover:text-foreground"
               >
                 <X className="h-5 w-5" />
               </button>
             </div>
             <AlertCircle className="h-10 w-10 text-primary mx-auto" />
             <p className="text-center text-sm text-muted-foreground">
               Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
             </p>
             <div className="space-y-2">
               <Label htmlFor="forgotEmail">Correo electrónico</Label>
               <div className="relative">
                 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input
                   id="forgotEmail"
                   type="email"
                   placeholder="tu@negocio.com"
                   className="pl-9"
                   value={forgotEmail}
                   onChange={(e) => setForgotEmail(e.target.value)}
                   autoFocus
                 />
               </div>
             </div>
             <Button
               className="w-full"
               onClick={handleForgotPassword}
               disabled={forgotLoading || !forgotEmail}
             >
               {forgotLoading ? "Enviando..." : "Enviar enlace de recuperación"}
             </Button>
           </div>
         </div>
       )}
     </div>
   );
}
