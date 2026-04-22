import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware (P1-8 / P1-9).
 *
 * Responsibilities:
 * 1. Attach defense-in-depth security headers on every response (also set in
 *    `next.config.ts` but duplicated here so Route Handlers also benefit).
 * 2. Mark admin pages as `noindex` — this is an internal responder console
 *    and must never appear in search engines.
 *
 * Auth gating itself stays client-side (see `components/DashboardLayout.tsx`).
 * Firebase ID tokens are held in-memory by the Firebase SDK rather than in
 * cookies, so this edge middleware cannot perform server-side token
 * verification. If that becomes necessary (for true server-rendered gating),
 * the admin would need to mint a session cookie from the ID token and verify
 * it here via the Firebase Admin SDK. The current client-side redirect path
 * remains in place as defense-in-depth.
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Next.js + inline scripts it generates + Google Maps JS loader.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // Google Maps tiles + marker sprites.
      "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://maps.gstatic.com",
      // API backend + Google Maps APIs + Firebase.
      "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://firestore.googleapis.com https://*.firebaseio.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  );
  res.headers.set("X-Robots-Tag", "noindex, nofollow");

  return res;
}

export const config = {
  // Apply to every app route except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/.*).*)"],
};
