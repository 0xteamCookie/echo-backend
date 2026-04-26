/**
 * Tiny helper that resolves a backend path against the `be` Express server.
 *
 * The admin UI calls the backend directly — there is no Next.js BFF proxy
 * layer. Configure the backend origin via `NEXT_PUBLIC_BACKEND_URL` (must be
 * `NEXT_PUBLIC_` so the value is available in the browser bundle). The
 * backend must allow the admin origin via `CORS_ORIGINS`.
 */
export function apiUrl(path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
