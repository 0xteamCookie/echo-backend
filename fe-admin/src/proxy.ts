import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware (P1-8 / P1-9).
 *
 * Responsibilities:
 * 1. Attach defense-in-depth security headers on every response (also set in
 *    `next.config.ts` but duplicated here so error pages also benefit).
 * 2. Mark admin pages as `noindex` — this is an internal responder console
 *    and must never appear in search engines.
 *
 * There is no Next.js API proxy layer — the admin UI talks to the `be`
 * Express backend directly (see `src/lib/api.ts`). Auth gating stays
 * client-side (see `components/DashboardLayout.tsx`); Firebase ID tokens are
 * held in-memory by the Firebase SDK and forwarded as `Authorization: Bearer`
 * on each API call.
 */
export function proxy(_req: NextRequest) {
  const res = NextResponse.next();

  // The admin UI calls the `be` Express backend directly (no Next.js API
  // proxy layer). Read the backend origin from NEXT_PUBLIC_BACKEND_URL so it
  // can be whitelisted in `connect-src`. Falls back to the dev default.
  let backendOrigin = "";
  try {
    backendOrigin = new URL(
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000",
    ).origin;
  } catch {
    backendOrigin = "http://localhost:3000";
  }

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
      `connect-src 'self' ${backendOrigin} https://*.googleapis.com https://*.gstatic.com https://firestore.googleapis.com https://*.firebaseio.com`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
