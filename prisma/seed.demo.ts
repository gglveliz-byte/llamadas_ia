import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const db = new PrismaClient();

const ADMIN_PASSWORD_HASH =
  "pbkdf2$sha512$100000$a8c237a1359f7ba41f1b552cb267aa5b$27f1de36992b6a73ca82dcd8904b6a5a219f02ed86808aabe1e3375c72a4367a70f9ca22ec9cefd2ea41f37219f6b52a1f55b2ed471aa2d80acd36cbbe4d7b7d";
const CLIENTE_PASSWORD_HASH =
  "pbkdf2$sha512$100000$3422aa66e59fbe2492655909f2cbd0c8$53e3f40ef985ca2179805503d247f84c2bf3dbb5b7bada8fb6f53b5013080bb0305fe07149863a83d5f035f4f7553f069d9a139978e88c4c2870aacf7fa0ad5d";

async function main() {
  console.log("🌱 Sembrando base de datos VozIA (MODO DEMO)...");

  if (process.env.SEED_DEMO !== "true") {
    console.error("❌ SEED_DEMO=true requerido para ejecutar seed demo");
    console.error("   Uso: SEED_DEMO=true npx tsx prisma/seed.demo.ts");
    process.exit(1);
  }

  // ─── Admin User ───
  const admin = await db.user.upsert({
    where: { email: "admin@vozia.com" },
    update: { passwordHash: ADMIN_PASSWORD_HASH, role: "admin", isVerified: true },
    create: {
      email: "admin@vozia.com",
      passwordHash: ADMIN_PASSWORD_HASH,
      role: "admin",
      isVerified: true,
      businessName: "VozIA Administración",
    },
  });

  await db.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, saldo: 0 },
  });
  console.log("✅ Admin demo creado:", admin.email);

  // ─── Clientes Demo ───
  const clientes = [
    {
      email: "barberia@demo.com",
      businessName: "Barbería El Clásico",
      settings: {
        aiLanguage: "es",
        bookingMode: "hours" as const,
        defaultDurationMinutes: 30,
        businessHours: {
          lunes: { abierto: true, inicio: "09:00", fin: "18:00" },
          martes: { abierto: true, inicio: "09:00", fin: "18:00" },
          miercoles: { abierto: true, inicio: "09:00", fin: "18:00" },
          jueves: { abierto: true, inicio: "09:00", fin: "18:00" },
          viernes: { abierto: true, inicio: "09:00", fin: "18:00" },
          sabado: { abierto: true, inicio: "09:00", fin: "14:00" },
          domingo: { abierto: false, inicio: null, fin: null },
        },
        recursos: [
          { id: "silla-1", nombre: "Silla 1" },
          { id: "silla-2", nombre: "Silla 2" },
          { id: "silla-3", nombre: "Silla 3" },
        ],
        systemPromptContext: "Barbería tradicional con 3 sillas. Cortes de cabello desde $150, afeitado tradicional $120, corte+afeitado $250. Pagos en efectivo o tarjeta.",
      },
      phoneNumber: "+525511223344",
    },
    {
      email: "clinica@demo.com",
      businessName: "Clínica DentalCare",
      settings: {
        aiLanguage: "es",
        bookingMode: "hours" as const,
        defaultDurationMinutes: 45,
        businessHours: {
          lunes: { abierto: true, inicio: "08:00", fin: "17:00" },
          martes: { abierto: true, inicio: "08:00", fin: "17:00" },
          miercoles: { abierto: true, inicio: "08:00", fin: "17:00" },
          jueves: { abierto: true, inicio: "08:00", fin: "17:00" },
          viernes: { abierto: true, inicio: "08:00", fin: "15:00" },
          sabado: { abierto: true, inicio: "09:00", fin: "13:00" },
          domingo: { abierto: false, inicio: null, fin: null },
        },
        recursos: [
          { id: "dr-garcia", nombre: "Dr. García" },
          { id: "dra-lopez", nombre: "Dra. López" },
        ],
        systemPromptContext: "Clínica dental con 2 doctores. Limpieza dental $300, consulta general $200, extracción $400, blanqueamiento $800. Seguros aceptados: GNP, MetLife.",
      },
      phoneNumber: "+525533445566",
    },
    {
      email: "hotel@demo.com",
      businessName: "Hotel Vista Hermosa",
      settings: {
        aiLanguage: "en",
        bookingMode: "nights" as const,
        defaultDurationMinutes: 1440,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        businessHours: {
          lunes: { abierto: true, inicio: "00:00", fin: "23:59" },
          martes: { abierto: true, inicio: "00:00", fin: "23:59" },
          miercoles: { abierto: true, inicio: "00:00", fin: "23:59" },
          jueves: { abierto: true, inicio: "00:00", fin: "23:59" },
          viernes: { abierto: true, inicio: "00:00", fin: "23:59" },
          sabado: { abierto: true, inicio: "00:00", fin: "23:59" },
          domingo: { abierto: true, inicio: "00:00", fin: "23:59" },
        },
        modo247: true,
        recursos: [
          { id: "hab-101", nombre: "Habitación 101 - Vista al mar" },
          { id: "hab-201", nombre: "Suite 201 - Premium" },
          { id: "hab-301", nombre: "Habitación 301 - Económica" },
        ],
        systemPromptContext: "Hotel boutique con 3 habitaciones. Habitación vista al mar $150/noche, Suite Premium $250/noche, Económica $80/noche. Incluye desayuno. WiFi gratis. Check-in 3PM, Check-out 11AM.",
      },
      phoneNumber: "+525544556677",
    },
  ];

  for (const c of clientes) {
    const user = await db.user.upsert({
      where: { email: c.email },
      update: { passwordHash: CLIENTE_PASSWORD_HASH, role: "cliente", isVerified: true },
      create: {
        email: c.email,
        passwordHash: CLIENTE_PASSWORD_HASH,
        role: "cliente",
        isVerified: true,
        businessName: c.businessName,
      },
    });

    await db.businessSettings.upsert({
      where: { userId: user.id },
      update: c.settings,
      create: { userId: user.id, ...c.settings },
    });

    await db.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, saldo: 25.00 },
    });

    await db.phoneNumber.upsert({
      where: { phoneNumber: c.phoneNumber },
      update: {},
      create: {
        userId: user.id,
        phoneNumber: c.phoneNumber,
        countryCode: "+52",
        telnyxPhoneSid: "PN_demo_" + user.id.slice(0, 8),
        isActive: true,
      },
    });

    await db.walletTransaction.create({
      data: {
        userId: user.id,
        tipo: "recarga",
        monto: 25.00,
        saldoAnterior: 0,
        saldoNuevo: 25.00,
        descripcion: "Saldo inicial demo",
      },
    });

    console.log(`✅ Cliente demo creado: ${c.businessName} (${user.email})`);
  }

  // ─── Citas Demo ───
  const barberUser = await db.user.findUnique({ where: { email: "barberia@demo.com" } });
  if (barberUser) {
    const phone = await db.phoneNumber.findFirst({ where: { userId: barberUser.id } });
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(10, 0, 0, 0);

    await db.appointment.create({
      data: {
        userId: barberUser.id,
        phoneNumberId: phone?.id,
        customerName: "Juan Pérez",
        customerPhone: "+525511111111",
        startTime: manana,
        endTime: new Date(manana.getTime() + 30 * 60000),
        durationMinutes: 30,
        recursoId: "silla-1",
        status: "agendado",
      },
    });

    const pasadoManana = new Date(manana);
    pasadoManana.setDate(pasadoManana.getDate() + 1);
    pasadoManana.setHours(11, 0, 0, 0);

    await db.appointment.create({
      data: {
        userId: barberUser.id,
        phoneNumberId: phone?.id,
        customerName: "María García",
        customerPhone: "+525522222222",
        startTime: pasadoManana,
        endTime: new Date(pasadoManana.getTime() + 30 * 60000),
        durationMinutes: 30,
        recursoId: "silla-2",
        status: "agendado",
      },
    });

    console.log("✅ Citas demo creadas para Barbería");
  }

  console.log("\n🎉 Base de datos sembrada exitosamente (MODO DEMO)!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());