import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, generarJwt, generarRefreshJwt } from "@/lib/auth-utils";
import { loginSchema } from "@/lib/validators/schemas";
import { validate } from "@/lib/validators/helper";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const val = validate(loginSchema, body);
    if (val.error) return val.error;
    const { email, password } = val.data!;

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    if (user.isSuspended) {
      return NextResponse.json({ error: "Cuenta suspendida. Contacta al administrador." }, { status: 403 });
    }

    if (!user.isVerified) {
      return NextResponse.json({ error: "Cuenta no verificada. Revisa tu email." }, { status: 403 });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const jwtPayload = { userId: user.id, email: user.email, role: user.role as "cliente" | "admin" };
    const token = generarJwt(jwtPayload);
    const refreshToken = generarRefreshJwt(jwtPayload);

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
      },
      token,
      refreshToken,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
