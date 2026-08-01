import { NextRequest, NextResponse } from "next/server";

const MOBILE_REGEX = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|playbook|silk|kindle|webos/i;

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  const isMobile = MOBILE_REGEX.test(ua);

  const res = NextResponse.next();
  res.cookies.set("dispositivo", isMobile ? "movil" : "desktop", {
    path: "/",
    maxAge: 60 * 60,
    sameSite: "lax",
  });

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
