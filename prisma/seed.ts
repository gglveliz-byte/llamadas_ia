import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const db = new PrismaClient();

async function main() {
  console.log("🌱 Sembrando base de datos VozIA (configuración base)...");

  // ─── Admin Config ───
  const adminConfigs = [
    { clave: "saldo_trial", valor: "5.00", descripcion: "Regalo inicial (USD) que se le da a un cliente nuevo al registrarse para que pruebe el servicio gratis." },
    { clave: "limite_saldo_negativo", valor: "-5.00", descripcion: "Límite máximo de deuda (en negativo) permitido antes de suspender al cliente. Ej: -5.00 significa que puede deber 5 USD antes de ser bloqueado." },
    { clave: "cobro_por_segundo", valor: "false", descripcion: "Si está activado (true), cobra los segundos exactos hablados. Si está desactivado (false), redondea hacia arriba y cobra el minuto completo (ej. 61 segs = 2 min)." },
    { clave: "precio_minuto_default", valor: "0.50", descripcion: "Precio por minuto predeterminado para los clientes si no tienen ninguna configuración o paquete especial asignado." },
    { clave: "mensaje_mantenimiento", valor: "", descripcion: "Si escribes algo aquí, toda la plataforma se bloqueará mostrando este mensaje a los clientes. Déjalo vacío para funcionamiento normal." },
    { clave: "alerta_cpu_porcentaje", valor: "85", descripcion: "Si el servidor supera este porcentaje de uso de CPU, se te enviará un correo de alerta." },
    { clave: "alerta_ram_porcentaje", valor: "90", descripcion: "Si el servidor supera este porcentaje de uso de Memoria RAM, se te enviará un correo de alerta." },
    { clave: "alerta_latencia_ms", valor: "5000", descripcion: "Milisegundos máximos permitidos en la respuesta de audio antes de considerarlo un problema de red (latencia alta)." },
    { clave: "email_admin_alertas", valor: "admin@vozia.com", descripcion: "Correo electrónico del administrador a donde llegarán las alertas de sistema y notificaciones importantes." },
    { clave: "vad_base_threshold", valor: "0.66", descripcion: "Sensibilidad de la IA para detectar voz humana vs ruido. Valores más altos (0.8) la hacen más sorda a ruidos, más bajos (0.4) detecta cualquier sonido como voz." },
    { clave: "vad_min_frames", valor: "3", descripcion: "Cuántos pequeños fragmentos de audio consecutivos deben tener voz para estar seguros. Subirlo evita interrumpir la IA por ruidos cortos." },
    { clave: "vad_noise_boost", valor: "0.25", descripcion: "Ajuste dinámico automático en entornos ruidosos para no interrumpir equivocadamente." },
    { clave: "vad_ignore_audio_until", valor: "500", descripcion: "Milisegundos durante los cuales la IA es totalmente sorda inmediatamente después de que termina de hablar. Evita que escuche su propio eco." },
    { clave: "vad_ai_speaking_window", valor: "400", descripcion: "Inmunidad temporal en milisegundos tras interrumpir a la IA para estabilizar la línea de audio y evitar cortes bruscos." },
    { clave: "vad_negative_threshold", valor: "0.45", descripcion: "Umbral por debajo del cual consideramos firmemente que el usuario dejó de hablar (silencio absoluto)." },
    { clave: "gemini_prefix_pad_ms", valor: "250", descripcion: "Audio pre-grabado que se envía a la IA antes del primer sonido detectado para evitar que se coman las primeras letras de la frase." },
    { clave: "gemini_silence_ms", valor: "250", descripcion: "Milisegundos de silencio necesarios para que la IA entienda que el usuario ya terminó de hablar y comience a pensar la respuesta." },
    { clave: "flujo_audio", valor: "continuo", descripcion: "continuo = Envía todo el audio para interrupciones súper rápidas. gated = Pone una barrera anti-ruido antes de enviarlo (más seguro ante ruido pero levemente más lento)." },
    { clave: "dias_gracia_liberacion", valor: "5", descripcion: "Días que mantienes 'secuestrado' o reservado un número de teléfono de un cliente que no ha pagado la renta antes de eliminarlo por completo de tu cuenta de Telnyx." },
    { clave: "precio_alta_numero", valor: "1.00", descripcion: "Costo referencial (USD) para activar un número telefónico nuevo si el proveedor (Telnyx) no reporta su costo real por fallo de API." },
    { clave: "precio_mes_numero", valor: "1.00", descripcion: "Costo mensual referencial (USD) para un número si el proveedor (Telnyx) no reporta el costo real de renta mensual." },
    { clave: "margen_numero_pct", valor: "50", descripcion: "Porcentaje (%) de ganancia o sobreprecio que la plataforma le cobra a los dueños de negocio por adquirir un número. Ej: Si Telnyx cobra $1 y esto es 50, se lo vendes al dueño a $1.50." },
    { clave: "precio_minuto_minimo", valor: "0.50", descripcion: "El costo base de operación de la plataforma por minuto. Los dueños de negocio NO pueden vender minutos a sus propios clientes finales a un precio menor a este." },
    { clave: "fee_instalacion_minimo", valor: "50.00", descripcion: "Cobro inicial fijo y obligatorio que los dueños de negocio le deben exigir a sus clientes finales por el setup o instalación del agente." },
    { clave: "deposito_retencion_minimo", valor: "10.00", descripcion: "Monto mínimo obligatorio que los clientes finales deben dejar como depósito de garantía (retención de tarjeta) antes de poder agendar una cita o iniciar llamada." },
    { clave: "comision_min_fija_default", valor: "0.05", descripcion: "Cantidad de dinero fijo (USD) por minuto que gana un afiliado cada vez que los negocios referidos por él tienen llamadas con clientes finales." },
    { clave: "dias_alerta_inactividad", valor: "90", descripcion: "Cantidad de días que deben pasar sin que un afiliado refiera a alguien o genere ventas para que se dispare una alerta de abandono." },
  ];

  for (const c of adminConfigs) {
    await db.adminConfig.upsert({
      where: { clave: c.clave },
      update: { valor: c.valor },
      create: c,
    });
  }
  console.log("✅ Configuración admin insertada");

  // ─── Recharge Packages (Comentado porque el modelo no existe en schema.prisma) ───
  // const packages = [
  //   { nombre: "Paquete Básico", montoRecarga: 10, saldoOtorgado: 10, precioPorMinuto: 0.50, activo: true },
  //   { nombre: "Paquete Pro", montoRecarga: 25, saldoOtorgado: 28, precioPorMinuto: 0.40, activo: true },
  //   { nombre: "Paquete Business", montoRecarga: 50, saldoOtorgado: 60, precioPorMinuto: 0.30, activo: true },
  //   { nombre: "Paquete Ilimitado", montoRecarga: 100, saldoOtorgado: 130, precioPorMinuto: 0.25, activo: true },
  // ];

  // for (const p of packages) {
  //   await (db as any).rechargePackage?.upsert({
  //     where: { id: p.montoRecarga === 10 ? 1 : p.montoRecarga === 25 ? 2 : p.montoRecarga === 50 ? 3 : 4 },
  //     update: p,
  //     create: p,
  //   });
  // }
  // console.log("✅ Paquetes de recarga creados");

  console.log("\n🎉 Configuración base sembrada exitosamente!");
  console.log("💡 Para crear cuentas demo: SEED_DEMO=true npx tsx prisma/seed.demo.ts");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());