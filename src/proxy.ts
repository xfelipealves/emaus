import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/** Checagem otimista: sem cookie de sessão, manda para o login. A validação real é no servidor. */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|c/|api/auth|_next|manifest.webmanifest|sw.js|offline.html|icon|apple-icon|favicon|icons/).*)",
  ],
};
