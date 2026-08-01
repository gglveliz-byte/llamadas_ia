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
    { clave: "alerta_latencia_ms", valor: "600", descripcion: "Umbral de latencia de audio para alerta" },
    { clave: "email_admin_alertas", valor: "admin@vozia.com", descripcion: "Email del admin para recibir alertas" },
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