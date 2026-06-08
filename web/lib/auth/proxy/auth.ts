import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { buildLoginUrl } from "@/lib/auth/redirect";
import { isProtectedPath } from "@/lib/auth/routes";

export function handleAuthProxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login" || !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const returnPath = search ? `${pathname}${search}` : pathname;
    return NextResponse.redirect(new URL(buildLoginUrl(returnPath), request.url));
  }

  return NextResponse.next();
}
