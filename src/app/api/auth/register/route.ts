import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth-utils";
import crypto from "crypto";
import { registerSchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";
// import { ApiClient } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const val = validate(registerSchema, body);
    if (val.error) return val.error;
    const { email, password, businessName, businessPhone } = val.data!;

    const existente = await db.user.findUnique({ where: { email } });
    if (existente) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role: "cliente",
        businessName: businessName || null,
        businessPhone: businessPhone || null,
        verificationToken,
        wallet: {
          create: { saldo: 0, moneda: "USD" },
        },
        settings: {
          create: {},
        },
      },
    });

    // Crear Telnyx Child Account para el nuevo cliente vía internal API
    // Reintentos con backoff: absorben ventanas de reinicio del backend Express.
    const webhookBaseUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
    let telnyxChildAccountId: string | null = null;
    let telnyxApiKeyEncrypted: string | null = null;
    let telnyxProvisioningStatus = "pendiente";
    let telnyxProvisioningError: string | null = null;

    const maxIntentos = 3;
    for (let intento = 1; intento <= maxIntentos; intento++) {
      try {
        const expressUrl = process.env.DOMINIO_EXPRESS || "http://localhost:3001";
        const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";
        
        // Timeout de 3 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${expressUrl}/internal/telnyx/create-child-account`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-internal-api-key": internalApiKey,
          },
          body: JSON.stringify({
            businessName: user.businessName || user.email,
            email,
            webhookBaseUrl: expressUrl,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
           const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
           throw new Error(err.error || `HTTP ${response.status}`);
        }
        
        const setup = (await response.json()) as { 
          childAccountId: string; 
          apiKeyEncrypted: string; 
          connectionId: string 
        };

        telnyxChildAccountId = setup.childAccountId;
        telnyxApiKeyEncrypted = setup.apiKeyEncrypted;
        telnyxProvisioningStatus = "completado";
        break;
      } catch (e) {
        const errorMsg = (e as Error).message;
        if (intento < maxIntentos) {
          const espera = 400 * 2 ** (intento - 1); // 400ms, 800ms
          console.warn({ error: errorMsg, userId: user.id, intento }, "Reintentando creación de Telnyx child account");
          await new Promise((r) => setTimeout(r, espera));
        } else {
          telnyxProvisioningError = errorMsg;
          console.warn({ error: errorMsg, userId: user.id }, "No se pudo crear Telnyx child account, quedará pendiente");
        }
      }
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        telnyxChildAccountId,
        telnyxApiKeyEncrypted,
        telnyxProvisioningStatus,
        telnyxProvisioningError,
      },
    });

    // Enviar email verificación vía backend interno
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
          subject: "Verifica tu cuenta - VozIA",
          text: `Haz clic aquí para verificar tu cuenta: ${frontendUrl}/api/auth/verify?token=${verificationToken}`,
          html: `<p>Bienvenido a VozIA. Haz clic <a href="${frontendUrl}/api/auth/verify?token=${verificationToken}">aquí</a> para verificar tu cuenta.</p>`
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (e) {
      console.error("Error enviando email verificación:", (e as Error).message);
    }

    return NextResponse.json({
      mensaje: "Cuenta creada. Revisa tu email para verificarla.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        businessName: user.businessName,
        businessPhone: user.businessPhone,
        isVerified: user.isVerified,
        isSuspended: user.isSuspended,
        telnyxChildAccountId: user.telnyxChildAccountId,
        telnyxProvisioningStatus: user.telnyxProvisioningStatus,
        telnyxProvisioningError: user.telnyxProvisioningError,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
