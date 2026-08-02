import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarJwt } from "@/lib/auth-utils";
import { Whop } from "@whop/sdk";

const whop = new Whop({
  apiKey: process.env.WHOP_API_KEY || "dummy_api_key",
  environment: process.env.NEXT_PUBLIC_SANDBOX_MODE === "true" ? "sandbox" : "production",
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let userId: string;
  try {
    const token = authHeader.slice(7);
    const payload = verificarJwt(token);
    userId = payload.userId;
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const body = await req.json();
  const { packageId } = body;

  if (!packageId) {
    return NextResponse.json({ error: "packageId requerido" }, { status: 400 });
  }

  const paquete = await db.rechargePackage.findUnique({
    where: { id: parseInt(packageId) },
  });

  if (!paquete || !paquete.activo) {
    return NextResponse.json({ error: "Paquete no encontrado o inactivo" }, { status: 404 });
  }

  const whopCompanyId = process.env.WHOP_COMPANY_ID;
  if (!whopCompanyId) {
    return NextResponse.json({ error: "WHOP_COMPANY_ID no configurado" }, { status: 500 });
  }

  const frontendUrl = process.env.DOMINIO_FRONTEND;
  if (!frontendUrl) {
    return NextResponse.json({ error: "DOMINIO_FRONTEND no configurado" }, { status: 500 });
  }

  try {
    const checkout = await whop.checkoutConfigurations.create({
      account_id: whopCompanyId,
      plan: {
        title: `Recarga ${paquete.nombre}`,
        description: `Paquete de recarga ${paquete.nombre} - ${paquete.saldoOtorgado.toFixed(0)} USD saldo por ${paquete.montoRecarga.toFixed(2)} USD`,
        initial_price: paquete.montoRecarga.toNumber(),
        currency: "usd",
        plan_type: "one_time",
      },
      metadata: {
        user_id: userId,
        package_id: String(packageId),
      },
      redirect_url: `${frontendUrl}/dashboard?recarga=exito`,
    });

    let checkoutUrl = checkout.purchase_url;
    if (checkoutUrl && checkoutUrl.startsWith("/")) {
      checkoutUrl = `https://whop.com${checkoutUrl}`;
    }

    if (!checkoutUrl) {
      return NextResponse.json({ error: "No se pudo generar el link de pago" }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl, checkoutId: checkout.id });
  } catch (e) {
    console.error("[whop/checkout] Error:", (e as Error).message);
    return NextResponse.json({ error: "Error creando checkout" }, { status: 500 });
  }
}