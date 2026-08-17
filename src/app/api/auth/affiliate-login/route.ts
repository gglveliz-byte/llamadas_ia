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

    const affiliate = await db.affiliate.findUnique({ where: { email } });
    if (!affiliate) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    if (!verifyPassword(password, affiliate.passwordHash)) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const jwtPayload = { userId: affiliate.id, email: affiliate.email, role: "afiliado" as any };
    const token = generarJwt(jwtPayload);
    const refreshToken = generarRefreshJwt(jwtPayload);

    return NextResponse.json({
      user: {
        id: affiliate.id,
        email: affiliate.email,
        role: "afiliado",
        nombre: affiliate.nombre,
        slug: affiliate.slug,
        comisionPorMinuto: affiliate.comisionPorMinuto,
      },
      token,
      refreshToken,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
