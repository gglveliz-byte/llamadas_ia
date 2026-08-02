import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
// import { ApiClient } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });

    // Siempre respondemos OK por seguridad (no revelar si email existe)
    if (!user) {
      return NextResponse.json({ mensaje: "Si el email existe, recibirás instrucciones" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Enviar email vía backend interno
    try {
      const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
      await fetch(`${expressUrl}/internal/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "Recuperación de contraseña - VozIA",
          text: `Usa este token para recuperar tu contraseña: ${resetToken}`,
          html: `<p>Usa este token para recuperar tu contraseña: <strong>${resetToken}</strong></p>`
        })
      });
    } catch (e) {
      console.error("Error enviando email recuperación:", (e as Error).message);
      // No fallamos la request por esto
    }

    return NextResponse.json({ mensaje: "Si el email existe, recibirás instrucciones" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}