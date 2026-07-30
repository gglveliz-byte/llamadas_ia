"use client";

import * as React from "react";
import {
  User,
  Brain,
  Phone,
  Clock,
  Mic,
  Save,
  Plus,
  Trash2,
  Globe,
  Check,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ApiClient, type BusinessSettings } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HorarioDia {
  abierto: boolean;
  inicio: string | null;
  fin: string | null;
}

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const DIAS_LABEL: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

const IDIOMAS = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
];

const TIMEZONES = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Buenos_Aires",
  "America/Lima",
  "America/Santiago",
  "America/Guatemala",
  "Europe/Madrid",
  "US/Eastern",
  "US/Pacific",
  "UTC",
];

export function ConfiguracionSection() {
  const { usuario } = useAppStore();
  const [settings, setSettings] = React.useState<BusinessSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [phoneNumbers, setPhoneNumbers] = React.useState<
    Array<{ id: number; phoneNumber: string; countryCode: string; isActive: boolean; purchasedAt: string }>
  >([]);

  const cargar = React.useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        ApiClient.get<{ settings: BusinessSettings }>(
          `/api/business-settings?userId=${usuario.id}`
        ),
        ApiClient.get<{ numbers: Array<{ id: number; phoneNumber: string; countryCode: string; isActive: boolean; purchasedAt: string }> }>(
          `/api/phone-numbers?userId=${usuario.id}`
        ),
      ]);
      setSettings(s.settings);
      setPhoneNumbers(p.numbers);
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async (parcial?: Partial<BusinessSettings>) => {
    if (!usuario || !settings) return;
    setSaving(true);
    try {
      const payload = parcial ?? settings;
      await ApiClient.patch("/api/business-settings", {
        userId: usuario.id,
        ...payload,
      });
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const comprarNumero = async () => {
    if (!usuario) return;
    try {
      await ApiClient.post("/api/phone-numbers", { userId: usuario.id, countryCode: "+52" });
      toast.success("Número comprado (simulado)");
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  if (loading || !settings) {
    return (
      <Card className="panel-wa">
        <CardContent className="p-6">
          <div className="h-64 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="perfil" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
        <TabsTrigger value="perfil" className="text-xs gap-1">
          <User className="h-3.5 w-3.5" /> Perfil
        </TabsTrigger>
        <TabsTrigger value="contexto" className="text-xs gap-1">
          <Brain className="h-3.5 w-3.5" /> Contexto
        </TabsTrigger>
        <TabsTrigger value="numeros" className="text-xs gap-1">
          <Phone className="h-3.5 w-3.5" /> Números
        </TabsTrigger>
        <TabsTrigger value="horarios" className="text-xs gap-1">
          <Clock className="h-3.5 w-3.5" /> Horarios
        </TabsTrigger>
        <TabsTrigger value="grabaciones" className="text-xs gap-1">
          <Mic className="h-3.5 w-3.5" /> Grabación
        </TabsTrigger>
      </TabsList>

      {/* Perfil */}
      <TabsContent value="perfil">
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base">Perfil del negocio</CardTitle>
            <CardDescription>
              Información básica y configuración de idioma de la IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del negocio</Label>
                <Input
                  value={usuario?.businessName || ""}
                  disabled
                  className="bg-muted/30"
                />
                <p className="text-xs text-muted-foreground">
                  Se actualiza al registrarse. Contacta al admin para cambios.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Teléfono del negocio</Label>
                <Input
                  value={usuario?.businessPhone || ""}
                  disabled
                  className="bg-muted/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> Idioma de la IA
                </Label>
                <Select
                  value={settings.aiLanguage}
                  onValueChange={(v) => {
                    setSettings({ ...settings, aiLanguage: v });
                    guardar({ aiLanguage: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IDIOMAS.map((i) => (
                      <SelectItem key={i.code} value={i.code}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Zona horaria</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(v) => {
                    setSettings({ ...settings, timezone: v });
                    guardar({ timezone: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modo de citas</Label>
                <Select
                  value={settings.bookingMode}
                  onValueChange={(v: "hours" | "nights") => {
                    setSettings({ ...settings, bookingMode: v });
                    guardar({ bookingMode: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Por horas</SelectItem>
                    <SelectItem value="nights">Por noches</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Duración default (min)</Label>
                <Input
                  type="number"
                  value={settings.defaultDurationMinutes}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultDurationMinutes: parseInt(e.target.value) || 30 })
                  }
                  onBlur={() => guardar({ defaultDurationMinutes: settings.defaultDurationMinutes })}
                />
              </div>
              {settings.bookingMode === "nights" && (
                <>
                  <div className="space-y-2">
                    <Label>Check-in</Label>
                    <Input
                      type="time"
                      value={settings.checkInTime}
                      onChange={(e) => setSettings({ ...settings, checkInTime: e.target.value })}
                      onBlur={() => guardar({ checkInTime: settings.checkInTime })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Check-out</Label>
                    <Input
                      type="time"
                      value={settings.checkOutTime}
                      onChange={(e) => setSettings({ ...settings, checkOutTime: e.target.value })}
                      onBlur={() => guardar({ checkOutTime: settings.checkOutTime })}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo 24/7</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    La IA contesta siempre. Fuera de horario informa pero NO agenda.
                  </p>
                </div>
                <Switch
                  checked={settings.modo247}
                  onCheckedChange={(v) => {
                    setSettings({ ...settings, modo247: v });
                    guardar({ modo247: v });
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Contexto / RAG */}
      <TabsContent value="contexto">
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base">Contexto del negocio (RAG)</CardTitle>
            <CardDescription>
              Este texto se inyecta en el system prompt de Gemini al inicio de cada llamada.
              Define cómo la IA representa tu negocio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Contexto / Prompt del sistema</Label>
                <span className="text-xs text-muted-foreground">
                  {settings.systemPromptContext.length} caracteres
                </span>
              </div>
              <Textarea
                value={settings.systemPromptContext}
                onChange={(e) =>
                  setSettings({ ...settings, systemPromptContext: e.target.value })
                }
                rows={12}
                className="font-mono text-xs"
                placeholder="Ej: Barbería en Polanco. Servicios: corte clásico $200..."
              />
              <p className="text-xs text-muted-foreground">
                💡 Tip: Para extraer este contexto automáticamente con una entrevista de voz,
                usa el <strong>Simulador de Voz</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Recursos del negocio</Label>
              <p className="text-xs text-muted-foreground">
                Barbería: sillas · Clínica: doctores · Hotel: habitaciones
              </p>
              <RecursosEditor
                recursos={settings.recursos}
                onChange={(recursos) => {
                  setSettings({ ...settings, recursos });
                  guardar({ recursos });
                }}
              />
            </div>

            <Button onClick={() => guardar({ systemPromptContext: settings.systemPromptContext })} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Guardando..." : "Guardar contexto"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Números telefónicos */}
      <TabsContent value="numeros">
        <Card className="panel-wa">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Números telefónicos</CardTitle>
                <CardDescription>
                  Números comprados a través de Twilio y asignados a tu subcuenta.
                </CardDescription>
              </div>
              <Button onClick={comprarNumero} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Comprar número
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              <div className="divide-y divide-border">
                {phoneNumbers.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No tienes números. Compra uno para empezar a recibir llamadas.
                  </div>
                ) : (
                  phoneNumbers.map((n) => (
                    <div key={n.id} className="p-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold font-mono">{n.phoneNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {n.countryCode} · Comprado {new Date(n.purchasedAt).toLocaleDateString("es-MX")}
                        </div>
                      </div>
                      <Badge variant={n.isActive ? "default" : "secondary"}>
                        {n.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Horarios */}
      <TabsContent value="horarios">
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base">Horarios de atención</CardTitle>
            <CardDescription>
              Define los días y horarios en que la IA atiende llamadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {DIAS.map((dia) => {
              const h: HorarioDia = settings.businessHours[dia] || {
                abierto: false,
                inicio: null,
                fin: null,
              };
              return (
                <div
                  key={dia}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border"
                >
                  <div className="w-24">
                    <span className="text-sm font-semibold">{DIAS_LABEL[dia]}</span>
                  </div>
                  <Switch
                    checked={h.abierto}
                    onCheckedChange={(v) => {
                      const nuevoHorario = {
                        ...settings.businessHours,
                        [dia]: { ...h, abierto: v },
                      };
                      setSettings({ ...settings, businessHours: nuevoHorario });
                      guardar({ businessHours: nuevoHorario });
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {h.abierto ? "Abierto" : "Cerrado"}
                  </span>
                  {h.abierto && (
                    <>
                      <Input
                        type="time"
                        value={h.inicio || "09:00"}
                        onChange={(e) => {
                          const nuevoHorario = {
                            ...settings.businessHours,
                            [dia]: { ...h, inicio: e.target.value },
                          };
                          setSettings({ ...settings, businessHours: nuevoHorario });
                        }}
                        onBlur={() => guardar({ businessHours: settings.businessHours })}
                        className="w-32"
                      />
                      <span className="text-xs text-muted-foreground">a</span>
                      <Input
                        type="time"
                        value={h.fin || "18:00"}
                        onChange={(e) => {
                          const nuevoHorario = {
                            ...settings.businessHours,
                            [dia]: { ...h, fin: e.target.value },
                          };
                          setSettings({ ...settings, businessHours: nuevoHorario });
                        }}
                        onBlur={() => guardar({ businessHours: settings.businessHours })}
                        className="w-32"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Grabación */}
      <TabsContent value="grabaciones">
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base">Grabación de llamadas</CardTitle>
            <CardDescription>
              Las grabaciones se almacenan en Cloudflare R2 con URL firmada (1h expira).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Activar grabación</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Graba todas las llamadas automáticamente. El cliente debe dar consentimiento.
                  </p>
                </div>
                <Switch
                  checked={settings.grabacionActiva}
                  onCheckedChange={(v) => {
                    setSettings({ ...settings, grabacionActiva: v });
                    guardar({ grabacionActiva: v });
                  }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mensaje de consentimiento</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reproducido al inicio de la llamada antes de conectar con la IA.
                  </p>
                </div>
                <Switch
                  checked={settings.consentimientoActivo}
                  onCheckedChange={(v) => {
                    setSettings({ ...settings, consentimientoActivo: v });
                    guardar({ consentimientoActivo: v });
                  }}
                />
              </div>
              <Textarea
                value={settings.mensajeConsentimiento}
                onChange={(e) =>
                  setSettings({ ...settings, mensajeConsentimiento: e.target.value })
                }
                rows={3}
                disabled={!settings.consentimientoActivo}
              />
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300">
              ⚠️ El consentimiento de grabación es obligatorio en muchas jurisdicciones.
              Consulta las leyes locales antes de activar.
            </div>

            <Button onClick={() => guardar({ grabacionActiva: settings.grabacionActiva, consentimientoActivo: settings.consentimientoActivo, mensajeConsentimiento: settings.mensajeConsentimiento })} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Guardando..." : "Guardar configuración"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function RecursosEditor({
  recursos,
  onChange,
}: {
  recursos: Array<{ id: string; nombre: string }>;
  onChange: (r: Array<{ id: string; nombre: string }>) => void;
}) {
  const [nuevoNombre, setNuevoNombre] = React.useState("");

  const agregar = () => {
    if (!nuevoNombre.trim()) return;
    const id = nuevoNombre.toLowerCase().replace(/\s+/g, "_").slice(0, 30);
    onChange([...recursos, { id, nombre: nuevoNombre }]);
    setNuevoNombre("");
  };

  const eliminar = (id: string) => {
    onChange(recursos.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="Ej: Silla 1, Dr. García, Habitación 101"
          className="flex-1"
        />
        <Button size="sm" onClick={agregar}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {recursos.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {recursos.map((r) => (
            <Badge
              key={r.id}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {r.nombre}
              <button
                onClick={() => eliminar(r.id)}
                className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
