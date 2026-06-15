import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";
import { buildLoginUrl } from "@/lib/auth/redirect";
import { isProtectedPath } from "@/lib/auth/routes";

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
}

export function handleAuthProxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login" || !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const returnPath = search ? `${pathname}${search}` : pathname;
    return NextResponse.redirect(new URL(buildLoginUrl(returnPath), request.url));
  }

  return NextResponse.next();
}
