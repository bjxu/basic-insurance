// Combines two independent concerns on the same request pipeline:
// 1. Stateless token gate for /admin (REQ-22): no user accounts, just a
//    cookie compared against ADMIN_SECRET.
// 2. next-intl locale routing/negotiation for every other path.
// Admin/API routes are intentionally excluded from (2) — they stay
// unprefixed and German-only (see docs/superpowers/specs/2026-08-15-multilingual-i18n-design.md).

import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Constant-time comparison without node:crypto — middleware runs on the Edge
// Runtime, which doesn't support Node built-ins like timingSafeEqual.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedApi = pathname.startsWith("/api/admin");
  const isProtectedPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isProtectedApi || isProtectedPage) {
    const token = request.cookies.get("admin_token")?.value;
    const secret = process.env.ADMIN_SECRET;
    const authorized = Boolean(secret && token && safeEqual(token, secret));

    if (!authorized) {
      if (isProtectedApi) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAdminRoute) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/((?!api|_next|admin|.*\\..*).*)"],
};
