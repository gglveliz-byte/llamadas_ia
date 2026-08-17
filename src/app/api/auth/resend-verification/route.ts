import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      // Por seguridad, no decimos que no existe, solo devolvemos OK
      return NextResponse.json({ mensaje: "Si el correo existe, el enlace ha sido reenviado." });
    }

    if (user.isVerified) {
      return NextResponse.json({ error: "La cuenta ya está verificada" }, { status: 400 });
    }

    let verificationToken = user.verificationToken;
    if (!verificationToken) {
      verificationToken = crypto.randomBytes(32).toString("hex");
      await db.user.update({
        where: { id: user.id },
        data: { verificationToken },
      });
    }

    const frontendUrl = process.env.DOMINIO_FRONTEND || "http://localhost:3000";
    
    try {
      const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
      const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      await fetch(`${expressUrl}/internal/email`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-internal-api-key": internalApiKey,
        },
        body: JSON.stringify({
          to: email,
          subject: "Verifica tu cuenta - Voice IA",
          text: `Haz clic aquí para verificar tu cuenta: ${frontendUrl}/api/auth/verify?token=${verificationToken}`,
          html: `<p>Bienvenido a Voice IA. Haz clic <a href="${frontendUrl}/api/auth/verify?token=${verificationToken}">aquí</a> para verificar tu cuenta.</p>`
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (e) {
      console.error("Error reenviando email verificación:", (e as Error).message);
    }

    return NextResponse.json({ mensaje: "Enlace reenviado. Revisa tu bandeja de entrada." });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
