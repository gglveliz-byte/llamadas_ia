/**
 * Seed inicial de la plataforma VozIA.
 * Crea: admin, clientes demo, paquetes de recarga, configuración admin,
 * wallets, transacciones, números, citas, métricas, memoria RAG.
 */
import { db } from "../src/lib/db";

async function main() {
  console.log("🌱 Iniciando seed...");

  await db.notification.deleteMany();
  await db.callMetric.deleteMany();
  await db.callRecording.deleteMany();
  await db.appointment.deleteMany();
  await db.phoneNumber.deleteMany();
  await db.businessMemory.deleteMany();
  await db.adminConfig.deleteMany();
  await db.walletTransaction.deleteMany();
  await db.wallet.deleteMany();
  await db.rechargePackage.deleteMany();
  await db.businessSettings.deleteMany();
  await db.user.deleteMany();

  const admin = await db.user.create({
    data: {
      email: "admin@vozia.com",
      passwordHash: "$2a$10$demoadminhash000000000000000000000000000000000000000000",
      role: "admin",
      isVerified: true,
      businessName: "VozIA HQ",
      settings: {
        create: {
          aiLanguage: "es",
          bookingMode: "hours",
          defaultDurationMinutes: 30,
          timezone: "America/Mexico_City",
          systemPromptContext: "Plataforma administrativa VozIA. Acceso solo para administradores.",
        },
      },
      wallet: {
        create: {
          saldo: 0,
          moneda: "USD",
        },
      },
    },
  });

  const clientesData = [
    {
      email: "barberia@demo.com",
      businessName: "Barbería El Navaja",
      businessPhone: "+525511223344",
      twilioSubaccountSid: "ACbarberia001",
      aiLanguage: "es",
      bookingMode: "hours",
      defaultDurationMinutes: 30,
      recursos: '[{"id":"silla1","nombre":"Silla 1"},{"id":"silla2","nombre":"Silla 2"},{"id":"silla3","nombre":"Silla 3"}]',
      context: "Barbería en Polanco, CDMX. Servicios: corte clásico $200, fade $250, barba $120, diseño $80. Horario: Lun-Vie 9-19, Sáb 9-15. Aceptamos efectivo y tarjeta. No se permiten mascotas. Estacionamiento disponible en la calle. Pide nombre y teléfono al cliente.",
      phone: "+525511220001",
    },
    {
      email: "clinica@demo.com",
      businessName: "Clínica Dental Sonrisas",
      businessPhone: "+525522334455",
      twilioSubaccountSid: "ACclinica002",
      aiLanguage: "es",
      bookingMode: "hours",
      defaultDurationMinutes: 45,
      recursos: '[{"id":"dr_garcia","nombre":"Dr. García"},{"id":"dra_lopez","nombre":"Dra. López"}]',
      context: "Clínica dental en Coyoacán. Servicios: limpieza $500, empaste $800, endodoncia $2500, blanqueamiento $3000. Horario: Lun-Vie 10-18. Aseguradoras aceptadas: GNP, MetLife, AXA. Pedir número de póliza si aplica.",
      phone: "+525511220002",
    },
    {
      email: "hotel@demo.com",
      businessName: "Hotel Playa Azul",
      businessPhone: "+525533445566",
      twilioSubaccountSid: "AChotel003",
      aiLanguage: "es",
      bookingMode: "nights",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      recursos: '[{"id":"hab101","nombre":"Habitación 101"},{"id":"suite201","nombre":"Suite 201"}]',
      context: "Hotel boutique en Cancún. 12 habitaciones. Tarifas: estándar $1200/noche, suite $2500/noche, todo incluido +$800. Check-in 15:00, check-out 11:00. No fumadores. Se aceptan mascotas pequeñas con cargo $200/noche.",
      phone: "+525511220003",
    },
    {
      email: "spa@demo.com",
      businessName: "Spa Renacer",
      businessPhone: "+525544556677",
      twilioSubaccountSid: "ACspa004",
      aiLanguage: "es",
      bookingMode: "hours",
      defaultDurationMinutes: 60,
      recursos: '[{"id":"masaje1","nombre":"Sala Masaje 1"},{"id":"facial2","nombre":"Sala Facial 2"}]',
      context: "Spa en Roma Norte. Servicios: masaje relajante 60min $600, masaje profundo 90min $900, facial $700, envoltura de barro $800. Horario: Lun-Dom 10-20. Se aceptan pagos con tarjeta. 15% descuento en paquetes de 3 sesiones.",
      phone: "+525511220004",
    },
    {
      email: "consultor@demo.com",
      businessName: "Consultoría Legal Pérez",
      businessPhone: "+525555667788",
      twilioSubaccountSid: "ACconsultor005",
      aiLanguage: "es",
      bookingMode: "hours",
      defaultDurationMinutes: 60,
      recursos: "[]",
      context: "Bufete de abogados en Santa Fe. Especialidades: derecho mercantil, civil, laboral. Primera consulta $1500. Horario: Lun-Vie 9-18. Atendemos en español e inglés. Pedir resumen breve del caso al agendar.",
      phone: "+525511220005",
    },
  ];

  const clientes: { id: string; email: string; businessName: string }[] = [];

  for (const c of clientesData) {
    const user = await db.user.create({
      data: {
        email: c.email,
        passwordHash: "$2a$10$democlienthash000000000000000000000000000000000000000",
        role: "cliente",
        isVerified: true,
        businessName: c.businessName,
        businessPhone: c.businessPhone,
        twilioSubaccountSid: c.twilioSubaccountSid,
        twilioSubaccountAuthTokenEnc: "encrypted_demo_token_" + c.twilioSubaccountSid,
        settings: {
          create: {
            aiLanguage: c.aiLanguage,
            bookingMode: c.bookingMode,
            defaultDurationMinutes: c.defaultDurationMinutes,
            checkInTime: c.checkInTime ?? "15:00",
            checkOutTime: c.checkOutTime ?? "11:00",
            recursos: c.recursos,
            systemPromptContext: c.context,
            timezone: "America/Mexico_City",
            modo247: false,
            grabacionActiva: c.email === "clinica@demo.com",
            consentimientoActivo: c.email === "clinica@demo.com",
          },
        },
        wallet: {
          create: {
            saldo: c.email === "consultor@demo.com" ? 1.20 : 25 + Math.random() * 50,
            moneda: "USD",
          },
        },
        phoneNumbers: {
          create: {
            phoneNumber: c.phone,
            countryCode: "+52",
            twilioPhoneSid: "PN" + c.twilioSubaccountSid.slice(-6) + "1234",
          },
        },
      },
    });
    clientes.push({ id: user.id, email: user.email, businessName: c.businessName });

    await db.businessMemory.create({
      data: {
        userId: user.id,
        rawContext: c.context,
        status: "activo",
        version: 1,
      },
    });
  }

  const paquetes = [
    { nombre: "Trial", montoRecarga: 0, saldoOtorgado: 5, precioPorMinuto: 0.50 },
    { nombre: "Básico", montoRecarga: 10, saldoOtorgado: 18, precioPorMinuto: 0.45 },
    { nombre: "Pro", montoRecarga: 25, saldoOtorgado: 50, precioPorMinuto: 0.40 },
    { nombre: "Business", montoRecarga: 50, saldoOtorgado: 110, precioPorMinuto: 0.35 },
    { nombre: "Enterprise", montoRecarga: 100, saldoOtorgado: 250, precioPorMinuto: 0.30 },
  ];
  for (const p of paquetes) {
    await db.rechargePackage.create({
      data: {
        nombre: p.nombre,
        montoRecarga: p.montoRecarga,
        saldoOtorgado: p.saldoOtorgado,
        precioPorMinuto: p.precioPorMinuto,
        precioPorSegundo: p.precioPorMinuto / 60,
        activo: true,
      },
    });
  }

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
  for (const cfg of adminConfigs) {
    await db.adminConfig.create({ data: cfg });
  }

  for (const cliente of clientes) {
    await db.walletTransaction.create({
      data: {
        userId: cliente.id,
        tipo: "trial",
        monto: 5,
        saldoAnterior: 0,
        saldoNuevo: 5,
        descripcion: "Saldo de bienvenida (Trial)",
      },
    });
    const recargaMonto = 25;
    const saldoActual = await db.wallet.findUnique({ where: { userId: cliente.id } });
    const saldoPrevio = saldoActual?.saldo ?? 0;
    await db.walletTransaction.create({
      data: {
        userId: cliente.id,
        tipo: "recarga",
        monto: recargaMonto,
        saldoAnterior: saldoPrevio - recargaMonto,
        saldoNuevo: saldoPrevio,
        whopPaymentId: "whop_pay_" + Math.random().toString(36).slice(2, 12),
        descripcion: `Recarga Paquete Pro ($${recargaMonto})`,
      },
    });
    for (let i = 0; i < 8; i++) {
      const duracion = Math.floor(Math.random() * 600) + 30;
      const costo = (duracion / 60) * 0.40;
      const prev = saldoPrevio + (i * -costo);
      await db.walletTransaction.create({
        data: {
          userId: cliente.id,
          tipo: "debito",
          monto: -costo,
          saldoAnterior: prev,
          saldoNuevo: prev - costo,
          callSid: "CA" + Math.random().toString(36).slice(2, 14).toUpperCase(),
          descripcion: `Llamada ${duracion}s`,
        },
      });
    }
  }

  const ahora = new Date();
  const nombresDemo = [
    "María González", "Juan Pérez", "Ana Martínez", "Carlos Ruiz", "Laura Sánchez",
    "Pedro Ramírez", "Sofía Torres", "Diego Flores", "Valentina Castro", "Ricardo Mendoza",
    "Patricia Vargas", "Andrés Ortega", "Fernanda Salas", "Roberto Aguilar", "Elena Ríos",
  ];

  for (const cliente of clientes) {
    const settings = await db.businessSettings.findUnique({ where: { userId: cliente.id } });
    const recursos: { id: string; nombre: string }[] = settings?.recursos ? JSON.parse(settings.recursos) : [];
    const phone = await db.phoneNumber.findFirst({ where: { userId: cliente.id } });

    for (let i = 0; i < 12; i++) {
      const offsetDias = Math.floor(Math.random() * 30) - 10;
      const offsetHoras = Math.floor(Math.random() * 10) + 9;
      const inicio = new Date(ahora);
      inicio.setDate(inicio.getDate() + offsetDias);
      inicio.setHours(offsetHoras, Math.random() > 0.5 ? 0 : 30, 0, 0);
      const dur = settings?.defaultDurationMinutes ?? 30;
      const fin = new Date(inicio.getTime() + dur * 60000);
      const nombre = nombresDemo[Math.floor(Math.random() * nombresDemo.length)];
      const estado = ["agendado", "asistio", "no_asistio", "cancelado"][Math.floor(Math.random() * 4)];

      await db.appointment.create({
        data: {
          userId: cliente.id,
          phoneNumberId: phone?.id,
          customerName: nombre,
          customerPhone: "+52" + Math.floor(1000000000 + Math.random() * 9000000000),
          customerEmail: nombre.toLowerCase().replace(" ", ".") + "@email.com",
          startTime: inicio,
          endTime: fin,
          durationMinutes: dur,
          recursoId: recursos.length > 0 ? recursos[Math.floor(Math.random() * recursos.length)].id : null,
          status: estado,
          notes: Math.random() > 0.7 ? "Cliente recurrente" : null,
        },
      });
    }
  }

  for (const cliente of clientes) {
    for (let i = 0; i < 15; i++) {
      const inicio = new Date(ahora.getTime() - Math.random() * 86400000 * 7);
      const duracion = Math.floor(Math.random() * 600) + 30;
      const fin = new Date(inicio.getTime() + duracion * 1000);
      const cobro = (duracion / 60) * 0.40;
      await db.callMetric.create({
        data: {
          userId: cliente.id,
          callSid: "CA" + Math.random().toString(36).slice(2, 14).toUpperCase(),
          inicio,
          fin,
          duracionSegundos: duracion,
          latenciaPromedioMs: Math.floor(Math.random() * 400) + 100,
          latenciaMaxMs: Math.floor(Math.random() * 800) + 200,
          cobroAplicado: cobro,
          errorCode: Math.random() > 0.95 ? "31924" : null,
        },
      });
    }
  }

  for (const cliente of clientes) {
    await db.notification.create({
      data: {
        userId: cliente.id,
        tipo: "nueva_cita",
        titulo: "Nueva cita agendada",
        mensaje: "María González agendó para mañana a las 10:00",
      },
    });
    await db.notification.create({
      data: {
        userId: cliente.id,
        tipo: "llamada_finalizada",
        titulo: "Llamada finalizada",
        mensaje: "Llamada de 187s finalizada. Costo: $1.25",
      },
    });
    if (cliente.email === "consultor@demo.com") {
      await db.notification.create({
        data: {
          userId: cliente.id,
          tipo: "saldo_bajo",
          titulo: "Saldo bajo",
          mensaje: "Tu saldo está por debajo del 20%. Considera recargar.",
        },
      });
    }
  }

  console.log(`✅ Seed completado:
    - 1 admin (${admin.email})
    - ${clientes.length} clientes demo
    - ${paquetes.length} paquetes de recarga
    - ${adminConfigs.length} configuraciones admin
    - Transacciones, citas, métricas y notificaciones demo`);
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
