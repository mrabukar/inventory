import type { NextRequest } from "next/server";
import { handleAuthProxy } from "@/lib/auth/proxy/auth";

export function proxy(request: NextRequest) {
  return handleAuthProxy(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/products/:path*",
    "/inventory/:path*",
    "/sales/:path*",
    "/supply/:path*",
    "/expenses/:path*",
    "/financial/:path*",
    "/users/:path*",
    "/audit/:path*",
    "/submit-sale/:path*",
    "/my-stock/:path*",
    "/sales-history/:path*",
    "/login",
  ],
};
