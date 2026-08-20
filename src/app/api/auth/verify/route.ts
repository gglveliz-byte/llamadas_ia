import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const frontendUrl = process.env.DOMINIO_FRONTEND || `${req.nextUrl.protocol}//${req.headers.get('x-forwarded-host') || req.nextUrl.host}`;

  if (!token) {
    return NextResponse.redirect(new URL("/?error=token_requerido", frontendUrl));
  }

  const user = await db.user.findFirst({ where: { verificationToken: token } });
  if (!user) {
    return NextResponse.redirect(new URL("/?error=token_invalido", frontendUrl));
  }

  if (user.isVerified) {
    return NextResponse.redirect(new URL("/?error=ya_verificado", frontendUrl));
  }

  await db.user.update({
    where: { id: user.id },
    data: { isVerified: true, verificationToken: null },
  });

  return NextResponse.redirect(new URL("/?verificado=ok", frontendUrl));
}
