import { NextRequest, NextResponse } from "next/server";
import { verificarRefreshToken, generarJwt, generarRefreshJwt } from "@/lib/auth-utils";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token requerido" }, { status: 400 });
    }

    let payload;
    try {
      payload = verificarRefreshToken(refreshToken);
    } catch {
      return NextResponse.json({ error: "Refresh token inválido o expirado" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const jwtPayload = { userId: user.id, email: user.email, role: user.role as "cliente" | "admin" };
    const token = generarJwt(jwtPayload);
    const newRefreshToken = generarRefreshJwt(jwtPayload);

    return NextResponse.json({ token, refreshToken: newRefreshToken });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
