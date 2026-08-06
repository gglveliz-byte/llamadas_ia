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
  AlertTriangle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const { usuario, refreshWallet } = useAppStore();
  const [settings, setSettings] = React.useState<BusinessSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [searchModalOpen, setSearchModalOpen] = React.useState(false);
  const [phoneNumbers, setPhoneNumbers] = React.useState<
    Array<{
      id: number;
      phoneNumber: string;
      countryCode: string;
      isActive: boolean;
      purchasedAt: string;
      monthlyCost?: string | number | null;
      currency?: string | null;
      lastMonthlyChargeAt?: string | null;
      suspensionAt?: string | null;
      releasedAt?: string | null;
    }>
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

  const comprarNumeroSeleccionado = async (numero: NumeroDisponible) => {
    if (!usuario) return false;
    try {
      await ApiClient.post("/api/phone-numbers", {
        userId: usuario.id,
        phoneNumber: numero.phone_number,
        upfrontCost: numero.cost_information?.upfront_cost,
        monthlyCost: numero.cost_information?.monthly_cost,
        currency: numero.cost_information?.currency,
      });
      toast.success(`Número ${numero.phone_number} contratado. El alta se descontó de tu saldo.`);
      setSearchModalOpen(false);
      refreshWallet();
      cargar();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
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
    <>
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <Label className="flex items-center gap-1">
                  <Mic className="h-3.5 w-3.5" /> Voz de la IA
                </Label>
                <Select
                  value={settings.aiVoice}
                  onValueChange={(v) => {
                    setSettings({ ...settings, aiVoice: v });
                    guardar({ aiVoice: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Puck">Puck (Masculina)</SelectItem>
                    <SelectItem value="Charon">Charon (Masculina profunda)</SelectItem>
                    <SelectItem value="Fenrir">Fenrir (Masculina grave)</SelectItem>
                    <SelectItem value="Kore">Kore (Femenina clara)</SelectItem>
                    <SelectItem value="Aoede">Aoede (Femenina cálida)</SelectItem>
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

            <div className="space-y-2">
              <Label>Saludo personalizado de la IA (opcional)</Label>
              <Input
                placeholder="Ej: ¡Hola! Gracias por llamar a mi negocio. ¿En qué puedo ayudarte hoy?"
                maxLength={500}
                value={settings.mensajeSaludo ?? ""}
                onChange={(e) => setSettings({ ...settings, mensajeSaludo: e.target.value })}
                onBlur={() => guardar({ mensajeSaludo: settings.mensajeSaludo || null })}
              />
              <p className="text-xs text-muted-foreground">
                Es lo primero que dirá la IA al contestar cada llamada. Si lo dejas vacío, la IA se
                presentará sola con el nombre de tu negocio.
              </p>
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

      {/* Contexto */}
      <TabsContent value="contexto">
        <Card className="panel-wa">
          <CardHeader>
            <CardTitle className="text-base">Información del negocio</CardTitle>
            <CardDescription>
              Este texto es lo que tu asistente de voz conoce sobre tu negocio en cada llamada.
              Define cómo la IA representa tu negocio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Información del negocio</Label>
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
                usa el <strong>Configuración del Negocio</strong>.
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
              {saving ? "Guardando..." : "Guardar cambios"}
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
              Los números con los que tu negocio recibe llamadas. Compra el que más te convenga.
            </CardDescription>
              </div>
              <Button onClick={() => setSearchModalOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Comprar número
              </Button>
            </div>
          </CardHeader>
          {usuario?.telnyxProvisioningStatus === "pendiente" && (
            <div className="px-6 py-3 border-b border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Tu telefonía está en activación.
                Si no puedes comprar números, vuelve a intentarlo en unos minutos.
              </span>
            </div>
          )}
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              <div className="divide-y divide-border">
                {phoneNumbers.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No tienes números. Compra uno para empezar a recibir llamadas.
                  </div>
                ) : (
                  phoneNumbers.map((n) => {
                    const mensual =
                      typeof n.monthlyCost === "string" ? parseFloat(n.monthlyCost) : (n.monthlyCost ?? 0);
                    const base = new Date(n.lastMonthlyChargeAt ?? n.purchasedAt).getTime();
                    const proximoCobro = new Date(base + 30 * 86400000);
                    return (
                      <div key={n.id} className="p-3 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold font-mono">{n.phoneNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {n.countryCode} · Comprado {new Date(n.purchasedAt).toLocaleDateString("es-MX")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {n.releasedAt ? (
                              <span className="text-red-600 dark:text-red-400">
                                Liberado el {new Date(n.releasedAt).toLocaleDateString("es-MX")} por renta
                                impagada. Compra un número nuevo para recibir llamadas.
                              </span>
                            ) : !n.isActive && n.suspensionAt ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                Suspendido por renta impagada el{" "}
                                {new Date(n.suspensionAt).toLocaleDateString("es-MX")}. Recarga para
                                reactivarlo; si no, se liberará.
                              </span>
                            ) : mensual > 0 ? (
                              <>
                                Renta ${fmtMoney(mensual)} {n.currency || "USD"}/mes · próximo cobro{" "}
                                {proximoCobro.toLocaleDateString("es-MX")}
                              </>
                            ) : (
                              "Sin renta mensual registrada"
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={n.releasedAt ? "secondary" : n.isActive ? "default" : "secondary"}
                          className={n.releasedAt ? "text-red-600 border-red-500/30" : !n.isActive ? "text-amber-600 border-amber-500/30" : ""}
                        >
                          {n.releasedAt ? "Liberado" : n.isActive ? "Activo" : "Suspendido"}
                        </Badge>
                      </div>
                    );
                  })
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
              Las grabaciones de tus llamadas se guardan de forma segura.
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
    {usuario && (
      <SearchNumbersModal 
        open={searchModalOpen} 
        onClose={() => setSearchModalOpen(false)}
        onPurchase={comprarNumeroSeleccionado}
      />
    )}
    </>
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

interface NumeroDisponible {
  phone_number: string;
  national_format?: string;
  locality?: string;
  region?: string;
  area_code?: string;
  cost_information?: {
    upfront_cost?: number | string;
    monthly_cost?: number | string;
    currency?: string;
  };
}

const costoAlta = (n: NumeroDisponible) =>
  parseFloat(String(n.cost_information?.upfront_cost ?? "")) || 0;

// Telnyx puede reportar costos como string ("1.00000"): siempre normalizar
const fmtMoney = (v?: number | string | null) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return (typeof n === "number" && isFinite(n) ? n : 0).toFixed(2);
};

const PAISES: Record<string, string> = {
  US: "Estados Unidos",
  MX: "México",
  CO: "Colombia",
  ES: "España",
  EC: "Ecuador",
  AR: "Argentina",
  CL: "Chile",
  PE: "Perú",
  BR: "Brasil",
  CA: "Canadá",
  GB: "Reino Unido",
  AU: "Australia",
  FR: "Francia",
  DE: "Alemania",
  IT: "Italia",
  PR: "Puerto Rico",
  DO: "República Dominicana",
  PA: "Panamá",
  CR: "Costa Rica",
  UY: "Uruguay",
  PY: "Paraguay",
  BO: "Bolivia",
  GT: "Guatemala",
  SV: "El Salvador",
  HN: "Honduras",
  NI: "Nicaragua",
};

function SearchNumbersModal({
  open,
  onClose,
  onPurchase,
}: {
  open: boolean;
  onClose: () => void;
  onPurchase: (numero: NumeroDisponible) => Promise<boolean>;
}) {
  const { usuario } = useAppStore();
  const [country, setCountry] = React.useState("US");
  const [areaCode, setAreaCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [error, setError] = React.useState("");
  const [results, setResults] = React.useState<NumeroDisponible[]>([]);
  const [saldo, setSaldo] = React.useState<number | null>(null);
  const [confirmando, setConfirmando] = React.useState<NumeroDisponible | null>(null);
  const [comprando, setComprando] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState<number | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);

  React.useEffect(() => {
    if (!open || !usuario) return;
    setConfirmando(null);
    setError("");
    ApiClient.get<{ wallet: { saldo: number } }>(`/api/wallet?userId=${usuario.id}`)
      .then((w) => setSaldo(Number(w.wallet?.saldo ?? 0)))
      .catch(() => setSaldo(null));
  }, [open, usuario]);

  const fetchPage = async (p: number, append: boolean) => {
    const q = new URLSearchParams({ countryCode: country, limit: "20", page: String(p) });
    if (areaCode) q.append("areaCode", areaCode);
    const res = await ApiClient.get<{ numbers: NumeroDisponible[]; total?: number | null }>(
      `/api/phone-numbers/search?${q.toString()}`
    );
    const nums = res.numbers || [];
    setResults((prev) => (append ? [...prev, ...nums] : nums));
    setTotal(res.total ?? null);
    setPage(p);
    setSearched(true);
  };

  const search = async () => {
    setLoading(true);
    setError("");
    try {
      await fetchPage(1, false);
    } catch (e) {
      setError((e as Error).message || "No se pudo buscar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const cargarMas = async () => {
    setLoadingMore(true);
    setError("");
    try {
      await fetchPage(page + 1, true);
    } catch (e) {
      setError((e as Error).message || "No se pudo cargar más.");
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmarCompra = async () => {
    if (!confirmando) return;
    setComprando(true);
    try {
      const ok = await onPurchase(confirmando);
      if (ok) setConfirmando(null);
    } finally {
      setComprando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !comprando && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contratar número telefónico</DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-2">
            <span>Elige el número con el que tu IA atenderá llamadas.</span>
            {saldo !== null && (
              <Badge variant="outline" className="shrink-0 text-emerald-600 border-emerald-500/30">
                Saldo: ${saldo.toFixed(2)}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-blue-700 dark:text-blue-300">
            ¿Cómo se paga un número?
          </p>
          <p>
            • <strong className="text-foreground">Activación</strong> (pago único): se descuenta
            una sola vez al comprar.
          </p>
          <p>
            • <strong className="text-foreground">Renta mensual</strong> (suscripción): se
            descuenta cada 30 días y mantiene el número activo recibiendo llamadas.
          </p>
          <p>
            Ambos cargos van a tu saldo VozIA. Los números no se compran para siempre: las redes
            telefónicas los rentan mes a mes; si cancelas la renta, el número se libera.
          </p>
        </div>

        {confirmando ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="font-mono font-semibold text-sm">
                  {confirmando.national_format || confirmando.phone_number}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {[confirmando.locality, confirmando.region].filter(Boolean).join(", ") || "Ubicación no disponible"}
              </div>
              <div className="rounded-md bg-muted p-3 space-y-1 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">
                    Pagas hoy · activación (pago único)
                  </span>
                  <span className="font-semibold text-sm text-foreground">
                    ${fmtMoney(confirmando.cost_information?.upfront_cost)}{" "}
                    {confirmando.cost_information?.currency || "USD"}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">Después · renta cada 30 días</span>
                  <span className="font-semibold text-sm text-foreground">
                    ${fmtMoney(confirmando.cost_information?.monthly_cost)}{" "}
                    {confirmando.cost_information?.currency || "USD"}/mes
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ambos cargos se descuentan de tu saldo VozIA (no se cobra por Whop ni se crea
                suscripción externa). La renta se cobra cada 30 días; si el saldo no alcanza, el
                número se suspende y, tras unos días de gracia sin pagar, se libera y deberás
                comprar uno nuevo.
              </p>
              {saldo !== null && saldo < costoAlta(confirmando) && (
                <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Saldo insuficiente para el pago de alta. Recarga en la sección Recargas.
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmando(null)} disabled={comprando}>
                Cancelar
              </Button>
              <Button
                onClick={confirmarCompra}
                disabled={comprando || (saldo !== null && saldo < costoAlta(confirmando))}
              >
                {comprando ? "Comprando..." : "Confirmar compra"}
              </Button>
            </div>
          </div>
        ) : (
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>País</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAISES).map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Código de área (Opcional)</Label>
              <Input
                placeholder="Ej. 212"
                inputMode="numeric"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
          </div>
          <Button onClick={search} disabled={loading}>
            {loading ? "Buscando..." : "Buscar números"}
          </Button>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </span>
              <Button variant="outline" size="sm" onClick={search}>
                Reintentar
              </Button>
            </div>
          )}

          {loading && (
            <div className="space-y-2 mt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <div className="text-sm text-center text-muted-foreground py-10 space-y-1.5">
              <p className="font-medium text-foreground">
                No hay números disponibles en {PAISES[country] ?? country} por ahora.
              </p>
              <p className="text-xs">La cobertura varía según el país.</p>
              <p className="text-xs">
                Prueba con Estados Unidos, México o Colombia, o intenta sin código de área.
              </p>
            </div>
          )}

          {!loading && !searched && !error && (
            <div className="text-sm text-center text-muted-foreground py-10">
              Busca para ver los números disponibles con sus precios.
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-muted-foreground">
                Mostrando {results.length}
                {total !== null ? ` de ${total}` : ""} números en {PAISES[country] ?? country} ·
                precios en {results[0]?.cost_information?.currency || "USD"}
              </div>
              <ScrollArea className="h-[50vh] rounded-lg border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.map((n) => {
                    const upfront = costoAlta(n);
                    const insuficiente = saldo !== null && saldo < upfront;
                    return (
                      <div
                        key={n.phone_number}
                        className="rounded-lg border border-border p-4 space-y-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-base font-semibold truncate">
                              {n.national_format || n.phone_number}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {[n.locality, n.region].filter(Boolean).join(", ") ||
                                (n.area_code ? `Código de área ${n.area_code}` : PAISES[country] ?? country)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={insuficiente}
                            onClick={() => setConfirmando(n)}
                          >
                            Comprar
                          </Button>
                        </div>
                        <div className="rounded-md bg-muted p-3 space-y-1 text-xs">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-muted-foreground">Pagas hoy (activación)</span>
                            <span className="font-semibold text-sm text-foreground">
                              ${fmtMoney(n.cost_information?.upfront_cost)}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-muted-foreground">Después (renta mensual)</span>
                            <span className="font-semibold text-sm text-foreground">
                              ${fmtMoney(n.cost_information?.monthly_cost)}/mes
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground pt-1">
                            El pago único no es de por vida: es la activación. La renta mantiene el
                            número activo.
                          </p>
                        </div>
                        {insuficiente && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Saldo insuficiente para el pago de alta.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {total !== null && results.length < total && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" size="sm" onClick={cargarMas} disabled={loadingMore}>
                    {loadingMore
                      ? "Cargando..."
                      : `Cargar más (${total - results.length} restantes)`}
                  </Button>
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Los costos los descuenta VozIA de tu saldo: la activación al comprar y la renta cada 30 días.
          </p>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
