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
 * Auth gating itself stays client-side (see `components/DashboardLayout.tsx`)
 * because tokens live in `localStorage`; a server middleware cannot read them.
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Next.js + inline scripts it generates.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // Google Maps tiles + OpenStreetMap tiles for Leaflet.
      "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.openstreetmap.org https://*.tile.openstreetmap.org",
      // API backend + Google Maps APIs + Firebase (P2 prep).
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
