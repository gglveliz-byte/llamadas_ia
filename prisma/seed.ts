import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const db = new PrismaClient();

async function main() {
  console.log("🌱 Sembrando base de datos VozIA (configuración base)...");

  // ─── Admin Config ───
  const adminConfigs = [
    { clave: "saldo_trial", valor: "5.00", descripcion: "Saldo de regalo para nuevos usuarios (USD)" },
    { clave: "limite_saldo_negativo", valor: "-5.00", descripcion: "Límite de saldo negativo antes de bloquear llamadas" },
    { clave: "cobro_por_segundo", valor: "false", descripcion: "true = cobrar por segundo, false = cobrar por minuto completo" },
    { clave: "precio_minuto_default", valor: "0.50", descripcion: "Precio por minuto si no hay paquete asignado" },
    { clave: "mensaje_mantenimiento", valor: "", descripcion: "Mensaje global de mantenimiento (vacío = desactivado)" },
    { clave: "alerta_cpu_porcentaje", valor: "85", descripcion: "Umbral de CPU para alerta al admin" },
    { clave: "alerta_ram_porcentaje", valor: "90", descripcion: "Umbral de RAM para alerta al admin" },
    { clave: "alerta_latencia_ms", valor: "5000", descripcion: "Umbral de latencia de audio para alerta" },
    { clave: "email_admin_alertas", valor: "admin@vozia.com", descripcion: "Email del admin para recibir alertas" },
    { clave: "vad_base_threshold", valor: "0.66", descripcion: "Umbral base de detección de voz (Silero VAD) [0.0 - 1.0]" },
    { clave: "vad_min_frames", valor: "3", descripcion: "Frames mínimos de confirmación para voz (cada frame = 32ms)" },
    { clave: "vad_noise_boost", valor: "0.25", descripcion: "Aumento de sensibilidad en entorno ruidoso (umbral adaptativo)" },
    { clave: "vad_ignore_audio_until", valor: "500", descripcion: "Milisegundos de sordera post-interrupción (evita audio fantasma)" },
    { clave: "vad_ai_speaking_window", valor: "400", descripcion: "Milisegundos de inmunidad anti-eco tras hablar la IA" },
    { clave: "vad_negative_threshold", valor: "0.45", descripcion: "Umbral negativo de Silero VAD para declarar silencio [0.0 - 1.0]" },
    { clave: "gemini_prefix_pad_ms", valor: "250", descripcion: "Pre-padding de audio antes del inicio de palabra en el auto-VAD de Gemini (ms)" },
    { clave: "gemini_silence_ms", valor: "250", descripcion: "Silencio requerido por Gemini para cerrar el turno del usuario (ms)" },
    { clave: "flujo_audio", valor: "continuo", descripcion: "continuo = todo el audio fluye a Gemini (barge-in nativo); gated = gate anti-ruido con pre-roll 250ms" },
    { clave: "dias_gracia_liberacion", valor: "5", descripcion: "Días de gracia tras suspender un número por renta impagada antes de liberarlo en Telnyx" },
    { clave: "precio_alta_numero", valor: "1.00", descripcion: "Precio por defecto de activación de número cuando Telnyx no reporta costo (USD)" },
    { clave: "precio_mes_numero", valor: "1.00", descripcion: "Precio por defecto de renta mensual de número cuando Telnyx no reporta costo (USD)" },
    { clave: "margen_numero_pct", valor: "50", descripcion: "Margen % sobre el costo real del número (activación y renta) para el precio al cliente" },
  ];

  for (const c of adminConfigs) {
    await db.adminConfig.upsert({
      where: { clave: c.clave },
      update: { valor: c.valor },
      create: c,
    });
  }
  console.log("✅ Configuración admin insertada");

  // ─── Recharge Packages ───
  const packages = [
    { nombre: "Paquete Básico", montoRecarga: 10, saldoOtorgado: 10, precioPorMinuto: 0.50, activo: true },
    { nombre: "Paquete Pro", montoRecarga: 25, saldoOtorgado: 28, precioPorMinuto: 0.40, activo: true },
    { nombre: "Paquete Business", montoRecarga: 50, saldoOtorgado: 60, precioPorMinuto: 0.30, activo: true },
    { nombre: "Paquete Ilimitado", montoRecarga: 100, saldoOtorgado: 130, precioPorMinuto: 0.25, activo: true },
  ];

  for (const p of packages) {
    await db.rechargePackage.upsert({
      where: { id: p.montoRecarga === 10 ? 1 : p.montoRecarga === 25 ? 2 : p.montoRecarga === 50 ? 3 : 4 },
      update: p,
      create: p,
    });
  }
  console.log("✅ Paquetes de recarga creados");

  console.log("\n🎉 Configuración base sembrada exitosamente!");
  console.log("💡 Para crear cuentas demo: SEED_DEMO=true npx tsx prisma/seed.demo.ts");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());