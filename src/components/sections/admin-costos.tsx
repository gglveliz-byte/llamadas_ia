"use client";

import * as React from "react";
import {
  DollarSign,
  Search,
  Save,
  Trash2,
  Plus,
  RefreshCw,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Globe,
  Loader2,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import { ApiClient } from "@/lib/api";
import { PAISES } from "@/lib/paises";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface NumberPricing {
  phoneNumber: string;
  region: string | null;
  upfrontCost: string | null;
  monthlyCost: string | null;
  currency: string;
}

interface NumberPricingResponse {
  countryCode: string;
  numbers: NumberPricing[];
  margenPct: number;
  totalAvailable: number | null;
}

interface TelnyxRate {
  id: number;
  countryCode: string;
  countryName: string;
  inboundPerMin: number;
  outboundPerMin: number;
  callControlFee: number;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPaisInfo(code: string) {
  return PAISES.find((p) => p.codigo === code);
}

function precioConMargen(base: string | null, margenPct: number): string {
  const val = parseFloat(base ?? "0");
  if (!val || !isFinite(val)) return "—";
  const factor = 1 + margenPct / 100;
  return (Math.round(val * factor * 100) / 100).toFixed(2);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AdminCostosSection() {
  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Costos Operativos</h2>
          <p className="text-sm text-muted-foreground">
            Precios reales de Telnyx: números telefónicos y tarifas por minuto
          </p>
        </div>
      </div>

      <Tabs defaultValue="numbers" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="numbers" className="gap-2">
            <Phone className="h-4 w-4" />
            Costos de Números
          </TabsTrigger>
          <TabsTrigger value="rates" className="gap-2">
            <Globe className="h-4 w-4" />
            Tarifas por Minuto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="numbers">
          <NumberPricingTab />
        </TabsContent>

        <TabsContent value="rates">
          <RatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: Costos de Números ───────────────────────────────────────────────

function NumberPricingTab() {
  const [selectedCountry, setSelectedCountry] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<NumberPricingResponse | null>(null);

  const consultarPrecios = async (code: string) => {
    if (!code) return;
    setSelectedCountry(code);
    setLoading(true);
    setData(null);
    try {
      const result = await ApiClient.get<NumberPricingResponse>(
        `/api/admin/telnyx-costs?countryCode=${code}`
      );
      setData(result);
    } catch (e: any) {
      toast.error(e.message || "Error consultando precios");
    } finally {
      setLoading(false);
    }
  };

  const pais = getPaisInfo(selectedCountry);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Precios de Números Telefónicos
        </CardTitle>
        <CardDescription>
          Consulta los precios reales de compra y renta mensual directamente desde la API de Telnyx.
          Se aplica tu margen configurado para calcular el precio de venta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs space-y-1.5">
            <Label>Seleccionar país</Label>
            <Select value={selectedCountry} onValueChange={consultarPrecios}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir país…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {PAISES.map((p) => (
                  <SelectItem key={p.codigo} value={p.codigo}>
                    {p.bandera} {p.nombre} ({p.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCountry && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => consultarPrecios(selectedCountry)}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refrescar
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Consultando precios en Telnyx…
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">País</div>
                <div className="text-lg font-semibold">
                  {pais?.bandera} {pais?.nombre}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">Disponibles</div>
                <div className="text-lg font-semibold">
                  {data.totalAvailable?.toLocaleString() ?? "N/A"}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">Margen</div>
                <div className="text-lg font-semibold">{data.margenPct}%</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">Muestra</div>
                <div className="text-lg font-semibold">{data.numbers.length} números</div>
              </div>
            </div>

            {/* Tabla */}
            {data.numbers.length > 0 ? (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Región</TableHead>
                      <TableHead className="text-right">Costo Alta (Telnyx)</TableHead>
                      <TableHead className="text-right">Costo Mensual (Telnyx)</TableHead>
                      <TableHead className="text-right">Precio Venta (Alta)</TableHead>
                      <TableHead className="text-right">Precio Venta (Mensual)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.numbers.map((n) => (
                      <TableRow key={n.phoneNumber}>
                        <TableCell className="font-mono text-sm">
                          {n.phoneNumber}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {n.region || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {n.upfrontCost ? `$${parseFloat(n.upfrontCost).toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {n.monthlyCost ? `$${parseFloat(n.monthlyCost).toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                          {n.upfrontCost ? `$${precioConMargen(n.upfrontCost, data.margenPct)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                          {n.monthlyCost ? `$${precioConMargen(n.monthlyCost, data.margenPct)}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No hay números disponibles para este país en Telnyx.
              </div>
            )}
          </div>
        )}

        {!data && !loading && (
          <div className="py-12 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Selecciona un país para consultar los precios de números
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 2: Tarifas por Minuto ──────────────────────────────────────────────

function RatesTab() {
  const [rates, setRates] = React.useState<TelnyxRate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<Set<string>>(new Set());
  const [editingRows, setEditingRows] = React.useState<
    Record<string, { inboundPerMin: string; outboundPerMin: string; callControlFee: string }>
  >({});
  const [showAdd, setShowAdd] = React.useState(false);
  const [processingCsv, setProcessingCsv] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [newRate, setNewRate] = React.useState({
    countryCode: "",
    inboundPerMin: "0.01",
    outboundPerMin: "0.01",
    callControlFee: "0.002",
  });

  const cargar = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<{ rates: TelnyxRate[] }>("/api/admin/telnyx-costs/rates");
      setRates(res.rates);
    } catch (e: any) {
      toast.error(e.message || "Error cargando tarifas");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarFila = async (code: string) => {
    const edit = editingRows[code];
    if (!edit) return;
    const existing = rates.find((r) => r.countryCode === code);
    const pais = getPaisInfo(code);

    setSaving((prev) => new Set(prev).add(code));
    try {
      await ApiClient.put("/api/admin/telnyx-costs/rates", {
        countryCode: code,
        countryName: existing?.countryName ?? pais?.nombre ?? code,
        inboundPerMin: parseFloat(edit.inboundPerMin),
        outboundPerMin: parseFloat(edit.outboundPerMin),
        callControlFee: parseFloat(edit.callControlFee),
      });
      toast.success(`Tarifa ${code} guardada`);
      setEditingRows((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });
      cargar();
    } catch (e: any) {
      toast.error(e.message || "Error guardando tarifa");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    }
  };

  const eliminar = async (code: string) => {
    if (!confirm(`¿Eliminar tarifa de ${code}?`)) return;
    try {
      await ApiClient.delete(`/api/admin/telnyx-costs/rates?countryCode=${code}`);
      toast.success(`Tarifa ${code} eliminada`);
      cargar();
    } catch (e: any) {
      toast.error(e.message || "Error eliminando tarifa");
    }
  };

  const agregarNueva = async () => {
    if (!newRate.countryCode) {
      toast.error("Selecciona un país");
      return;
    }
    const pais = getPaisInfo(newRate.countryCode);
    setSaving((prev) => new Set(prev).add("new"));
    try {
      await ApiClient.put("/api/admin/telnyx-costs/rates", {
        countryCode: newRate.countryCode,
        countryName: pais?.nombre ?? newRate.countryCode,
        inboundPerMin: parseFloat(newRate.inboundPerMin),
        outboundPerMin: parseFloat(newRate.outboundPerMin),
        callControlFee: parseFloat(newRate.callControlFee),
      });
      toast.success(`Tarifa ${newRate.countryCode} agregada`);
      setShowAdd(false);
      setNewRate({ countryCode: "", inboundPerMin: "0.01", outboundPerMin: "0.01", callControlFee: "0.002" });
      cargar();
    } catch (e: any) {
      toast.error(e.message || "Error agregando tarifa");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete("new");
        return next;
      });
    }
  };

  const startEdit = (r: TelnyxRate) => {
    setEditingRows((prev) => ({
      ...prev,
      [r.countryCode]: {
        inboundPerMin: String(r.inboundPerMin),
        outboundPerMin: String(r.outboundPerMin),
        callControlFee: String(r.callControlFee),
      },
    }));
  };

  const updateEdit = (code: string, field: string, value: string) => {
    setEditingRows((prev) => ({
      ...prev,
      [code]: { ...prev[code], [field]: value },
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingCsv(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          if (rows.length === 0) throw new Error("CSV vacío");

          // Detect type by checking common headers
          const hasDestination = rows[0].destination !== undefined || rows[0].Destination !== undefined;
          const hasCountry = rows[0].country !== undefined || rows[0].Country !== undefined;

          if (!hasDestination && !hasCountry) {
            throw new Error("El archivo no parece ser un Rate Deck de Telnyx (faltan columnas destination/country)");
          }

          toast.info(`Procesando ${rows.length} filas...`);

          // Aggregate MAX rate per country
          const maxRates: Record<string, number> = {};

          for (const row of rows) {
            const destName = (row.destination || row.Destination || row.country || row.Country || "").toLowerCase();
            const rateStr = row.rate || row.Rate || row.amount || row.Amount || "0";
            const rate = parseFloat(rateStr);
            if (isNaN(rate) || !destName) continue;

            // Find matching country in our PAISES array
            const matchedPais = PAISES.find(p => destName.startsWith(p.nombre.toLowerCase()) || destName.includes(p.nombre.toLowerCase()));
            if (matchedPais) {
              const code = matchedPais.codigo;
              if (!maxRates[code] || rate > maxRates[code]) {
                maxRates[code] = rate;
              }
            } else {
               // Also try to match common english names since Telnyx is in English
               const isUS = destName.includes("united states") || destName.includes("us48");
               const isUK = destName.includes("united kingdom");
               const isES = destName.includes("spain");
               const isEC = destName.includes("ecuador");
               const isCO = destName.includes("colombia");
               const isMX = destName.includes("mexico") || destName.includes("méxico");
               
               let code: string | null = null;
               if (isUS) code = "US";
               else if (isUK) code = "GB";
               else if (isES) code = "ES";
               else if (isEC) code = "EC";
               else if (isCO) code = "CO";
               else if (isMX) code = "MX";

               if (code) {
                 if (!maxRates[code] || rate > maxRates[code]) {
                    maxRates[code] = rate;
                 }
               }
            }
          }

          const codesFound = Object.keys(maxRates);
          if (codesFound.length === 0) {
            throw new Error("No se encontraron coincidencias de países en el archivo.");
          }

          // Prepare payload. We assume the uploaded file is Outbound for now, 
          // or Inbound if the user uploaded that one. We'll update BOTH inbound and outbound 
          // for simplicity if it's the first time, but actually it's better to update ONLY outbound 
          // if it looks like outbound. Wait, to avoid erasing existing Inbound, we merge with existing rates.
          const payload = codesFound.map(code => {
             const existing = rates.find(r => r.countryCode === code);
             const countryName = getPaisInfo(code)?.nombre || code;
             // Here we assume the CSV is for Outbound rates since it's the most common use case
             return {
                countryCode: code,
                countryName,
                inboundPerMin: existing ? Number(existing.inboundPerMin) : 0.005,
                outboundPerMin: maxRates[code],
                callControlFee: existing ? Number(existing.callControlFee) : 0.002,
             };
          });

          await ApiClient.post<{ count: number }>("/api/admin/telnyx-costs/rates/bulk", payload);
          toast.success(`Se actualizaron las tarifas salientes de ${payload.length} países con el precio máximo encontrado.`);
          cargar();

        } catch (e: any) {
          toast.error(e.message || "Error procesando el CSV");
        } finally {
          setProcessingCsv(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        toast.error(`Error parseando CSV: ${error.message}`);
        setProcessingCsv(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  // Países que aún no tienen tarifa configurada
  const paisesDisponibles = PAISES.filter(
    (p) => !rates.some((r) => r.countryCode === p.codigo)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Tarifas por Minuto de Llamadas
            </CardTitle>
            <CardDescription>
              Tarifas de voz inbound/outbound por país. Carga los valores del rate deck de Telnyx.
              El fee de Call Control ($0.002/min) se suma automáticamente.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={processingCsv}
              className="gap-1"
            >
              {processingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar CSV
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAdd(!showAdd)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Agregar País
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulario agregar nueva tarifa */}
        {showAdd && (
          <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-3">
            <div className="text-sm font-medium">Nueva Tarifa</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-xs">País</Label>
                <Select value={newRate.countryCode} onValueChange={(v) => setNewRate((p) => ({ ...p, countryCode: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="País…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {paisesDisponibles.map((p) => (
                      <SelectItem key={p.codigo} value={p.codigo}>
                        {p.bandera} {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Costo Base (Recibir)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  className="h-9"
                  value={newRate.inboundPerMin}
                  onChange={(e) => setNewRate((p) => ({ ...p, inboundPerMin: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Costo Base (Llamar)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  className="h-9"
                  value={newRate.outboundPerMin}
                  onChange={(e) => setNewRate((p) => ({ ...p, outboundPerMin: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Costo Sistema (API)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  className="h-9"
                  value={newRate.callControlFee}
                  onChange={(e) => setNewRate((p) => ({ ...p, callControlFee: e.target.value }))}
                />
              </div>
              <Button onClick={agregarNueva} disabled={saving.has("new")} className="h-9">
                {saving.has("new") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Guardar
              </Button>
            </div>
          </div>
        )}

        {/* Tabla de tarifas */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando tarifas…
          </div>
        ) : rates.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No hay tarifas configuradas. Haz clic en &quot;Agregar País&quot; para comenzar.
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>País de Operación</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1 text-xs">
                      <PhoneIncoming className="h-3.5 w-3.5" />
                      Costo Base (Recibir)
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1 text-xs">
                      <PhoneOutgoing className="h-3.5 w-3.5" />
                      Costo Base (Llamar)
                    </span>
                  </TableHead>
                  <TableHead className="text-right text-xs">Costo Sistema (API)</TableHead>
                  <TableHead className="text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">Total Final (Minuto Entrante)</TableHead>
                  <TableHead className="text-right text-xs font-bold text-orange-600 dark:text-orange-400">Total Final (Minuto Saliente)</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => {
                  const pais = getPaisInfo(r.countryCode);
                  const editing = editingRows[r.countryCode];
                  const isSaving = saving.has(r.countryCode);
                  const inbound = editing ? parseFloat(editing.inboundPerMin) : Number(r.inboundPerMin);
                  const outbound = editing ? parseFloat(editing.outboundPerMin) : Number(r.outboundPerMin);
                  const ccFee = editing ? parseFloat(editing.callControlFee) : Number(r.callControlFee);

                  return (
                    <TableRow
                      key={r.countryCode}
                      className={cn(editing && "bg-primary/5")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{pais?.bandera ?? "🏳️"}</span>
                          <div>
                            <div className="font-medium text-sm">{r.countryName}</div>
                            <div className="text-xs text-muted-foreground">{r.countryCode}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            className="h-8 w-24 ml-auto text-right"
                            value={editing.inboundPerMin}
                            onChange={(e) => updateEdit(r.countryCode, "inboundPerMin", e.target.value)}
                          />
                        ) : (
                          <span
                            className="font-mono text-sm cursor-pointer hover:text-primary transition-colors"
                            onClick={() => startEdit(r)}
                          >
                            ${Number(r.inboundPerMin).toFixed(4)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            className="h-8 w-24 ml-auto text-right"
                            value={editing.outboundPerMin}
                            onChange={(e) => updateEdit(r.countryCode, "outboundPerMin", e.target.value)}
                          />
                        ) : (
                          <span
                            className="font-mono text-sm cursor-pointer hover:text-primary transition-colors"
                            onClick={() => startEdit(r)}
                          >
                            ${Number(r.outboundPerMin).toFixed(4)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            className="h-8 w-24 ml-auto text-right"
                            value={editing.callControlFee}
                            onChange={(e) => updateEdit(r.countryCode, "callControlFee", e.target.value)}
                          />
                        ) : (
                          <span className="font-mono text-sm text-muted-foreground">
                            ${Number(r.callControlFee).toFixed(4)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        ${(inbound + ccFee).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">
                        ${(outbound + ccFee).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {editing ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setEditingRows((prev) => {
                                    const next = { ...prev };
                                    delete next[r.countryCode];
                                    return next;
                                  });
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => guardarFila(r.countryCode)}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3 mr-1" />
                                )}
                                Guardar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => startEdit(r)}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => eliminar(r.countryCode)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
