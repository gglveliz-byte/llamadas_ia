import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function update() {
  const updates = {
    'saldo_trial': 'Regalo inicial (USD) que se le da a un cliente nuevo al registrarse para que pruebe el servicio gratis.',
    'limite_saldo_negativo': 'Límite máximo de deuda (en negativo) permitido antes de suspender al cliente. Ej: -5.00 significa que puede deber 5 USD antes de ser bloqueado.',
    'cobro_por_segundo': 'Si está activado (true), cobra los segundos exactos hablados. Si está desactivado (false), redondea hacia arriba y cobra el minuto completo (ej. 61 segs = 2 min).',
    'precio_minuto_default': 'Precio por minuto predeterminado para los clientes si no tienen ninguna configuración o paquete especial asignado.',
    'mensaje_mantenimiento': 'Si escribes algo aquí, toda la plataforma se bloqueará mostrando este mensaje a los clientes. Déjalo vacío para funcionamiento normal.',
    'alerta_cpu_porcentaje': 'Si el servidor supera este porcentaje de uso de CPU, se te enviará un correo de alerta.',
    'alerta_ram_porcentaje': 'Si el servidor supera este porcentaje de uso de Memoria RAM, se te enviará un correo de alerta.',
    'alerta_latencia_ms': 'Milisegundos máximos permitidos en la respuesta de audio antes de considerarlo un problema de red (latencia alta).',
    'email_admin_alertas': 'Correo electrónico del administrador a donde llegarán las alertas de sistema y notificaciones importantes.',
    'vad_base_threshold': 'Sensibilidad de la IA para detectar voz humana vs ruido. Valores más altos (0.8) la hacen más sorda a ruidos, más bajos (0.4) detecta cualquier sonido como voz.',
    'vad_min_frames': 'Cuántos pequeños fragmentos de audio consecutivos deben tener voz para estar seguros. Subirlo evita interrumpir la IA por ruidos cortos.',
    'vad_noise_boost': 'Ajuste dinámico automático en entornos ruidosos para no interrumpir equivocadamente.',
    'vad_ignore_audio_until': 'Milisegundos durante los cuales la IA es totalmente sorda inmediatamente después de que termina de hablar. Evita que escuche su propio eco.',
    'vad_ai_speaking_window': 'Inmunidad temporal en milisegundos tras interrumpir a la IA para estabilizar la línea de audio y evitar cortes bruscos.',
    'vad_negative_threshold': 'Umbral por debajo del cual consideramos firmemente que el usuario dejó de hablar (silencio absoluto).',
    'gemini_prefix_pad_ms': 'Audio pre-grabado que se envía a la IA antes del primer sonido detectado para evitar que se coman las primeras letras de la frase.',
    'gemini_silence_ms': 'Milisegundos de silencio necesarios para que la IA entienda que el usuario ya terminó de hablar y comience a pensar la respuesta.',
    'flujo_audio': 'continuo = Envía todo el audio para interrupciones súper rápidas. gated = Pone una barrera anti-ruido antes de enviarlo (más seguro ante ruido pero levemente más lento).',
    'dias_gracia_liberacion': 'Días que mantienes \'secuestrado\' o reservado un número de teléfono de un cliente que no ha pagado la renta antes de eliminarlo por completo de tu cuenta de Telnyx.',
    'precio_alta_numero': 'Costo referencial (USD) para activar un número telefónico nuevo si el proveedor (Telnyx) no reporta su costo real por fallo de API.',
    'precio_mes_numero': 'Costo mensual referencial (USD) para un número si el proveedor (Telnyx) no reporta el costo real de renta mensual.',
    'margen_numero_pct': 'Porcentaje (%) de ganancia o sobreprecio que la plataforma le cobra a los dueños de negocio por adquirir un número. Ej: Si Telnyx cobra $1 y esto es 50, se lo vendes al dueño a $1.50.',
    'precio_minuto_minimo': 'El costo base de operación de la plataforma por minuto. Los dueños de negocio NO pueden vender minutos a sus propios clientes finales a un precio menor a este.',
    'fee_instalacion_minimo': 'Cobro inicial fijo y obligatorio que los dueños de negocio le deben exigir a sus clientes finales por el setup o instalación del agente.',
    'deposito_retencion_minimo': 'Monto mínimo obligatorio que los clientes finales deben dejar como depósito de garantía (retención de tarjeta) antes de poder agendar una cita o iniciar llamada.',
    'comision_min_fija_default': 'Cantidad de dinero fijo (USD) por minuto que gana un afiliado cada vez que los negocios referidos por él tienen llamadas con clientes finales.',
    'dias_alerta_inactividad': 'Cantidad de días que deben pasar sin que un afiliado refiera a alguien o genere ventas para que se dispare una alerta de abandono.'
  };
  
  for (const [clave, desc] of Object.entries(updates)) {
    await db.adminConfig.update({ where: { clave }, data: { descripcion: desc } }).catch(() => {});
  }
  console.log('Done');
}

update().finally(() => db.$disconnect());
