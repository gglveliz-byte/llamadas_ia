import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { derivarIdiomaDeRegion } from "@/lib/paises";

/**
 * GET /api/business-settings?userId=...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const settings = await db.businessSettings.findUnique({ where: { userId } });
  if (!settings) {
    return NextResponse.json({
      settings: {
        userId,
        aiLanguage: "es",
        aiVoice: "Dipper",
        aiRegion: "MX-es",
        bookingMode: "hours",
        defaultDurationMinutes: 30,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        businessHours: {
          lunes: { abierto: true, inicio: "09:00", fin: "18:00" },
          martes: { abierto: true, inicio: "09:00", fin: "18:00" },
          miercoles: { abierto: true, inicio: "09:00", fin: "18:00" },
          jueves: { abierto: true, inicio: "09:00", fin: "18:00" },
          viernes: { abierto: true, inicio: "09:00", fin: "18:00" },
          sabado: { abierto: true, inicio: "09:00", fin: "14:00" },
          domingo: { abierto: false, inicio: null, fin: null },
        },
        modo247: false,
        timezone: "America/Mexico_City",
        grabacionActiva: false,
        mensajeConsentimiento: "Esta llamada puede ser grabada para fines de calidad.",
        consentimientoActivo: false,
        formFields: [],
        systemPromptContext: "",
        recursos: [],
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({
    settings: {
      ...settings,
    },
  });
}

/**
 * PATCH /api/business-settings
 * Actualiza la configuración del negocio.
 * Body: { userId, ...campos a actualizar }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { userId, ...updates } = body;
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const data: Record<string, unknown> = { ...updates };

  // El idioma SIEMPRE se deriva del acento regional (nunca se configura libre):
  // si llega aiRegion, forzamos aiLanguage coherente con ese acento.
  if (typeof data.aiRegion === "string") {
    data.aiLanguage = derivarIdiomaDeRegion(data.aiRegion);
  }

  // Verificar si existe; si no, crear
  const existe = await db.businessSettings.findUnique({ where: { userId } });
  let settings;
  if (existe) {
    settings = await db.businessSettings.update({
      where: { userId },
      data,
    });
  } else {
    settings = await db.businessSettings.create({
      data: {
        userId,
        ...data,
      } as never,
    });
  }

  // En producción: invalidar Redis cache (contexto + settings)
  // await redis.del(`contexto:${userId}`);
  // await redis.del(`settings:${userId}`);

  return NextResponse.json({ settings });
}
