"use client";

import * as React from "react";
import { Phone, Mail, Shield, ArrowRight, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient, type Usuario } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface UsuarioDemo {
  id: string;
  email: string;
  businessName: string;
  role: "cliente" | "admin";
}

export function LoginScreen() {
  const { setUsuario, setSeccion } = useAppStore();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [usuariosDemo, setUsuariosDemo] = React.useState<UsuarioDemo[]>([]);

  React.useEffect(() => {
    ApiClient.get<{ clientes: UsuarioDemo[]; admin: UsuarioDemo[] }>(
      "/api/users"
    ).then((data) => {
      setUsuariosDemo([...data.admin, ...data.clientes]);
    });
  }, []);

  const login = async (usuarioDemo?: UsuarioDemo) => {
    setLoading(true);
    try {
      const target = usuarioDemo?.id;
      const res = await ApiClient.post<{
        user: Usuario;
      }>("/api/session", target ? { userId: target } : {});
      setUsuario(res.user);
      setSeccion("dashboard");
      toast.success(`Bienvenido, ${res.user.businessName || res.user.email}`);
    } catch (e) {
      toast.error("Error al iniciar sesión: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background chat-bg p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 rounded-full bg-primary items-center justify-center shadow-lg">
            <Phone className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VozIA</h1>
            <p className="text-sm text-muted-foreground">
              Plataforma SaaS de Agentes de Voz con IA
            </p>
          </div>
        </div>

        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Iniciar sesión
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
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => login()}
              disabled={loading || !email}
            >
              {loading ? "Cargando..." : "Entrar"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Acceso rápido demo
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto wa-scroll">
              {usuariosDemo.map((u) => (
                <button
                  key={u.id}
                  onClick={() => login(u)}
                  disabled={loading}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                >
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
                      u.role === "admin" ? "bg-amber-600" : "bg-primary"
                    }`}
                  >
                    {u.role === "admin" ? <Shield className="h-4 w-4" /> : u.businessName.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{u.businessName}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-center text-muted-foreground pt-2">
              Demo: haz click en cualquier negocio para entrar instantáneamente.
              En producción esto requeriría credenciales verificadas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
