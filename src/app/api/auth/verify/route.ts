import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/?error=token_requerido", req.url));
  }

  const user = await db.user.findFirst({ where: { verificationToken: token } });
  if (!user) {
    return NextResponse.redirect(new URL("/?error=token_invalido", req.url));
  }

  if (user.isVerified) {
    return NextResponse.redirect(new URL("/?error=ya_verificado", req.url));
  }

  await db.user.update({
    where: { id: user.id },
    data: { isVerified: true, verificationToken: null },
  });

  return NextResponse.redirect(new URL("/?verificado=ok", req.url));
}
