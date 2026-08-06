"use client";

import * as React from "react";
import { Save, Settings2, AlertTriangle } from "lucide-react";
import { ApiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConfigItem {
  id: number;
  clave: string;
  valor: string;
  descripcion: string | null;
}

const CLAVES_BOOL = ["cobro_por_segundo"];

const VAD_SLIDERS: Record<string, { min: number; max: number; step: number }> = {
  vad_base_threshold: { min: 0.0, max: 1.0, step: 0.01 },
  vad_min_frames: { min: 1, max: 10, step: 1 },
  vad_noise_boost: { min: 0.0, max: 0.5, step: 0.01 },
  vad_ignore_audio_until: { min: 0, max: 2000, step: 50 },
  vad_ai_speaking_window: { min: 0, max: 1000, step: 10 },
};

export function AdminConfigSection() {
  const [configs, setConfigs] = React.useState<ConfigItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [cambios, setCambios] = React.useState<Record<string, string>>({});
  const [guardando, setGuardando] = React.useState<Set<string>>(new Set());

  const cargar = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await ApiClient.get<{ configs: ConfigItem[] }>("/api/admin/config");
      setConfigs(data.configs);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const setCambio = (clave: string, valor: string) => {
    setCambios((prev) => ({ ...prev, [clave]: valor }));
  };

  const guardar = async (clave: string) => {
    const valor = cambios[clave];
    if (valor === undefined) return;
    setGuardando((prev) => new Set(prev).add(clave));
    try {
      await ApiClient.patch("/api/admin/config", { clave, valor });
      toast.success(`Configuración "${clave}" actualizada`);
      setCambios((prev) => {
        const next = { ...prev };
        delete next[clave];
        return next;
      });
      cargar();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    } finally {
      setGuardando((prev) => {
        const next = new Set(prev);
        next.delete(clave);
        return next;
      });
    }
  };

  const getValor = (c: ConfigItem) => cambios[c.clave] ?? c.valor;
  const hasCambio = (c: ConfigItem) => cambios[c.clave] !== undefined && cambios[c.clave] !== c.valor;

  // Agrupar configs por categoría
  const grupos: Record<string, ConfigItem[]> = {
    "Facturación": configs.filter((c) =>
      ["saldo_trial", "limite_saldo_negativo", "cobro_por_segundo", "precio_minuto_default", "dias_gracia_liberacion", "precio_alta_numero", "precio_mes_numero", "margen_numero_pct"].includes(c.clave)
    ),
    "Mantenimiento": configs.filter((c) => c.clave === "mensaje_mantenimiento"),
    "Alertas": configs.filter((c) =>
      ["alerta_cpu_porcentaje", "alerta_ram_porcentaje", "alerta_latencia_ms", "email_admin_alertas"].includes(c.clave)
    ),
    "Sensibilidad de Interrupción (VAD)": configs.filter((c) => c.clave.startsWith("vad_")),
  };

  if (loading) {
    return (
      <Card className="panel-wa">
        <CardContent className="p-6">
          <div className="h-64 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="panel-wa border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-300">
              Configuración global del sistema
            </p>
            <p className="text-xs text-muted-foreground">
              Estos valores afectan a TODOS los clientes. Los cambios se aplican inmediatamente.
              En producción se invalidaría el cache Redis al guardar.
            </p>
          </div>
        </CardContent>
      </Card>

      {Object.entries(grupos).map(([nombre, items]) => {
        if (items.length === 0) return null;
        return (
          <Card key={nombre} className="panel-wa">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                {nombre}
              </CardTitle>
              {nombre === "Alertas" && (
                <CardDescription className="text-xs">
                  El servicio <code className="font-mono">monitoring.service.ts</code> verifica
                  estos umbrales cada 10 segundos y envía email + SSE al admin si se exceden.
                </CardDescription>
              )}
              {nombre === "Sensibilidad de Interrupción (VAD)" && (
                <CardDescription className="text-xs">
                  Ajustes en vivo del modelo Silero VAD para el Voice Activity Detection y Anti-Eco.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((c) => {
                const esBool = CLAVES_BOOL.includes(c.clave);
                const esTextarea = c.clave === "mensaje_mantenimiento";
                const esSlider = VAD_SLIDERS[c.clave];
                const valorActual = getValor(c);
                const boolVal = valorActual === "true";
                const cambiado = hasCambio(c);

                return (
                  <div
                    key={c.id}
                    className={cn(
                      "grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 p-3 rounded-lg border",
                      cambiado ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-mono text-sm font-semibold">{c.clave}</Label>
                        {cambiado && (
                          <Badge variant="outline" className="text-[10px] text-primary">
                            Sin guardar
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{c.descripcion}</p>
                    </div>

                    <div className="flex items-end gap-2">
                      {esBool ? (
                        <div className="flex items-center gap-2 pb-1">
                          <Switch
                            checked={boolVal}
                            onCheckedChange={(v) => setCambio(c.clave, v ? "true" : "false")}
                          />
                          <span className="text-xs text-muted-foreground">
                            {boolVal ? "Activado" : "Desactivado"}
                          </span>
                        </div>
                      ) : esTextarea ? (
                        <Textarea
                          value={valorActual}
                          onChange={(e) => setCambio(c.clave, e.target.value)}
                          rows={2}
                          className="font-mono text-xs min-w-64"
                          placeholder="Vacío = desactivado"
                        />
                      ) : esSlider ? (
                        <div className="flex flex-col gap-2 min-w-48 pb-1">
                          <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
                            <span>{esSlider.min}</span>
                            <span className="font-bold text-primary">{valorActual}</span>
                            <span>{esSlider.max}</span>
                          </div>
                          <Slider
                            min={esSlider.min}
                            max={esSlider.max}
                            step={esSlider.step}
                            value={[parseFloat(valorActual) || esSlider.min]}
                            onValueChange={(val) => setCambio(c.clave, val[0].toString())}
                          />
                        </div>
                      ) : (
                        <Input
                          value={valorActual}
                          onChange={(e) => setCambio(c.clave, e.target.value)}
                          className="font-mono text-sm min-w-48"
                        />
                      )}
                      {cambiado && (
                        <Button
                          size="sm"
                          onClick={() => guardar(c.clave)}
                          disabled={guardando.has(c.clave)}
                        >
                          <Save className="h-3.5 w-3.5 mr-1" />
                          {guardando.has(c.clave) ? "..." : "Guardar"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
