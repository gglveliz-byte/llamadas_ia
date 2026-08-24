"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerBalance } from "@/components/landing/CustomerBalance";

interface BusinessData {
  tenantId: string;
  nombreEmpresa: string;
  precioPorMinuto: string;
  metodosPago: string[];
  depositoMinimo: string;
  landingLogo?: string;
  landingDescripcion?: string;
  aiRegion?: string;
  businessPhones?: string[];
}

// Función auxiliar para obtener datos del país según la región
function getCountryData(region?: string) {
  if (!region) return { code: "", flag: "🌐" };
  const upper = region.toUpperCase();
  if (upper.startsWith("MX")) return { code: "+52", flag: "🇲🇽" };
  if (upper.startsWith("CO")) return { code: "+57", flag: "🇨🇴" };
  if (upper.startsWith("EC")) return { code: "+593", flag: "🇪🇨" };
  if (upper.startsWith("PE")) return { code: "+51", flag: "🇵🇪" };
  if (upper.startsWith("AR")) return { code: "+54", flag: "🇦🇷" };
  if (upper.startsWith("CL")) return { code: "+56", flag: "🇨🇱" };
  if (upper.startsWith("ES")) return { code: "+34", flag: "🇪🇸" };
  if (upper.startsWith("US")) return { code: "+1", flag: "🇺🇸" };
  return { code: "", flag: "🌐" };
}

export default function PublicLandingPage() {
  const { slug } = useParams();
  const [data, setData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  
  const [metodoPago, setMetodoPago] = useState<"prepago" | "retencion">("prepago");
  const [minutos, setMinutos] = useState<number>(15);
  
  const [procesando, setProcesando] = useState(false);
  const [countryData, setCountryData] = useState({ code: "", flag: "🌐" });
  
  const [pagoExitoso, setPagoExitoso] = useState(false);
  
  useEffect(() => {
    // Check for success param
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("pago") === "exito") {
        setPagoExitoso(true);
        // Opcionalmente quitar el parámetro de la URL para que no vuelva a salir al recargar
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    async function fetchData() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${backendUrl}/api/public/business/${slug}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          const cData = getCountryData(json.aiRegion);
          setCountryData(cData);
        }
      } catch (e) {
        console.error("Error fetching business data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="bg-card p-8 rounded-2xl border shadow-sm max-w-sm w-full text-center">
          <h2 className="text-xl font-bold mb-2">Negocio no encontrado</h2>
          <p className="text-muted-foreground text-sm">
            Verifica que el enlace sea correcto.
          </p>
        </div>
      </div>
    );
  }

  const precioMinuto = parseFloat(data.precioPorMinuto);
  const totalPrepago = (minutos * precioMinuto).toFixed(2);
  const deposito = parseFloat(data.depositoMinimo || "10").toFixed(2);

  const handleCheckout = async () => {
    if (!nombre || !telefono) {
      return alert("Nombre y Teléfono son obligatorios");
    }
    
    const telefonoFinal = `${countryData.code}${telefono.replace(/\s+/g, "")}`.trim();
    
    setProcesando(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      
      const regRes = await fetch(`${backendUrl}/api/public/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tenantId: data.tenantId, 
          nombre, 
          telefono: telefonoFinal, 
          email: email.trim() === "" ? undefined : email.trim() 
        })
      });
      const customer = await regRes.json();
      
      if (!regRes.ok) {
        alert("Error al registrar cliente: " + (customer.error || "Desconocido"));
        setProcesando(false);
        return;
      }

      const chkRes = await fetch(`${backendUrl}/api/public/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: data.tenantId,
          endCustomerId: customer.id,
          tipo: metodoPago,
          minutos: metodoPago === "prepago" ? minutos : undefined,
          monto: metodoPago === "retencion" ? parseFloat(deposito) : undefined
        })
      });
      const chkData = await chkRes.json();
      
      if (chkRes.ok && chkData.url) {
        window.location.href = chkData.url;
      } else {
        alert("Error generando link de pago");
        setProcesando(false);
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión");
      setProcesando(false);
    }
  };

  const nombreMostrar = data.nombreEmpresa?.trim();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-foreground">
      
      {/* Header simple */}
      <header className="w-full bg-card border-b py-4 px-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          {data.landingLogo ? (
            <img src={data.landingLogo} alt={nombreMostrar || "Negocio"} className="h-8 w-auto object-contain" />
          ) : (
            <img src="/logotipo.png" alt="VozIA" className="h-8 w-auto object-contain" />
          )}
          {nombreMostrar && <h1 className="font-semibold text-lg">{nombreMostrar}</h1>}
        </div>
        <div className="hidden sm:block">
          <CustomerBalance tenantId={data.tenantId} countryData={countryData} />
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-card border rounded-2xl shadow-lg p-6 sm:p-8">
          
          {pagoExitoso ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-green-700">¡Pago Exitoso!</h2>
              <p className="text-muted-foreground text-base mb-6">
                Tu saldo ha sido recargado correctamente. Ya puedes comunicarte con nuestro asistente virtual con IA.
              </p>
              
              <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-6 mb-6">
                <p className="text-sm font-medium text-slate-500 mb-3">Llama ahora al siguiente número:</p>
                {data.businessPhones && data.businessPhones.length > 0 ? (
                  <div className="space-y-3">
                    {data.businessPhones.map((phone, i) => (
                      <div key={i} className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-bold tracking-wider">{phone}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-orange-500">
                    (El negocio aún no tiene un número asignado)
                  </p>
                )}
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setPagoExitoso(false)}
              >
                Hacer otra recarga
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">
                  {nombreMostrar ? `Agenda tu cita en ${nombreMostrar}` : "Agenda tu cita"}
                </h2>
                {data.landingDescripcion && (
                  <p className="text-muted-foreground text-sm">
                    {data.landingDescripcion}
                  </p>
                )}
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre Completo</Label>
                  <Input 
                    id="nombre" 
                    placeholder="Ej. Ana García" 
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico (Opcional)</Label>
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="Ej. ana@gmail.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <div className="flex">
                    <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 border-r-0 rounded-l-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground shadow-sm">
                      <span className="mr-1.5 text-base">{countryData.flag}</span>
                      {countryData.code}
                    </div>
                    <Input 
                      id="telefono" 
                      type="tel"
                      placeholder="99 123 4567" 
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      dir="ltr"
                      className="rounded-l-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Tabs defaultValue="prepago" onValueChange={(v) => setMetodoPago(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="prepago">Pago Exacto</TabsTrigger>
                      <TabsTrigger value="retencion">Depósito</TabsTrigger>
                    </TabsList>
                    
                    <div className="mt-6">
                      <TabsContent value="prepago" className="space-y-4">
                        <div className="bg-muted/50 p-4 rounded-xl border">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-sm font-medium">Tiempo deseado</span>
                            <span className="font-semibold">{minutos} min</span>
                          </div>
                          <Input 
                            type="range" 
                            min={5} 
                            max={60} 
                            step={5} 
                            value={minutos} 
                            onChange={(e) => setMinutos(parseInt(e.target.value))}
                            className="w-full cursor-pointer mb-4"
                          />
                          <div className="flex justify-between items-end pt-3 border-t">
                            <span className="text-xs text-muted-foreground">${precioMinuto.toFixed(2)} USD / minuto</span>
                            <span className="text-xl font-bold text-primary">
                              ${totalPrepago} USD
                            </span>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="retencion">
                        <div className="bg-muted/50 p-4 rounded-xl border text-sm text-muted-foreground">
                          <p className="mb-2">
                            Se realizará una retención de garantía por <strong>${deposito} USD</strong>.
                          </p>
                          <p>
                            Al terminar la llamada, se cobrarán <strong>${precioMinuto.toFixed(2)} USD</strong> por minuto hablado y se te reembolsará la diferencia inmediatamente.
                          </p>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>

                <Button 
                  className="w-full h-12 text-base font-medium"
                  onClick={handleCheckout}
                  disabled={procesando}
                >
                  {procesando 
                    ? "Procesando..." 
                    : (metodoPago === "prepago" ? `Pagar $${totalPrepago} USD` : `Pagar Garantía de $${deposito} USD`)}
                </Button>
              </div>
            </>
          )}
          
          <div className="mt-6 sm:hidden border-t pt-6">
             <CustomerBalance tenantId={data.tenantId} />
          </div>

        </div>
      </main>
    </div>
  );
}
