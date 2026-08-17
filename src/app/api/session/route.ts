import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarJwt } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    const payload = verificarJwt(token);
    
    if (payload.role === "afiliado" as any) {
      const affiliate = await db.affiliate.findUnique({ where: { id: payload.userId } });
      if (!affiliate) {
        return NextResponse.json({ error: "Afiliado no encontrado" }, { status: 404 });
      }
      return NextResponse.json({
        user: {
          id: affiliate.id,
          email: affiliate.email,
          role: "afiliado",
          nombre: affiliate.nombre,
          slug: affiliate.slug,
          comisionPorMinuto: affiliate.comisionPorMinuto,
        },
        wallet: null,
      });
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { settings: true, wallet: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({
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
        installationPaid: user.installationPaid,
        installationAmount: user.installationAmount ? Number(user.installationAmount) : 0,
      },
      settings: user.settings,
      wallet: user.wallet
        ? { ...user.wallet, saldo: user.wallet.saldo.toNumber() }
        : null,
    });
  } catch (error) {
    console.error("[Session API] Error en /api/session:", error);
    return NextResponse.json(
      { error: "Error interno verificando sesión", detalle: (error as Error).message },
      { status: 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { settings: true, wallet: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json({
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
      installationPaid: user.installationPaid,
      installationAmount: user.installationAmount ? Number(user.installationAmount) : 0,
    },
    settings: user.settings,
    wallet: user.wallet
      ? { ...user.wallet, saldo: user.wallet.saldo.toNumber() }
      : null,
  });
}
