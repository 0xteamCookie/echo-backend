/** Normalize PEM pasted into `.env` with literal `\n` sequences. */
function pemFromEnv(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\\n/g, "\n").trim();
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";

function requireEnv(name: string, fallback?: string): string {
  const raw = process.env[name]?.trim();
  if (raw) return raw;
  if (isProd) {
    throw new Error(
      `Missing required environment variable: ${name}. Refusing to boot in production.`,
    );
  }
  if (fallback !== undefined) {
    console.warn(
      `[config] ${name} not set; using insecure development fallback. Set this before deploying.`,
    );
    return fallback;
  }
  console.warn(`[config] ${name} not set; leaving empty (dev).`);
  return "";
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv,
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite",
  /** Set `TRIAGE_ENABLED=false` to skip Gemini on ingest (faster dummy seeding). */
  triageEnabled: process.env.TRIAGE_ENABLED !== "false",
  triageNearbyRadiusM: Number(process.env.TRIAGE_NEARBY_RADIUS_M) || 500,
  /** Allow browser demos (e.g. `public/demo.html`) to call the API from another origin. */
  corsOrigin: process.env.CORS_ORIGIN?.trim() || true,

  /** RSA PEM private key (PKCS#8) used to sign rescuer provisioning JWTs (RS256). */
  jwtPrivateKeyPem: pemFromEnv(process.env.JWT_PRIVATE_KEY),
  /** Issuer claim (`iss`) — must match what rescuer apps expect. */
  jwtIssuer: process.env.JWT_ISSUER?.trim() || "echo",
  /** Audience claim (`aud`) — must match embedded app config. */
  jwtAudience: process.env.JWT_AUDIENCE?.trim() || "echo-rescuer",
  /** Key id for JWT header and JWKS (`kid`). */
  jwtKeyId: process.env.JWT_KEY_ID?.trim() || "echo-provisioning-1",
  /** Default lifetime for issued rescuer tokens (seconds). 72h per P1-12. */
  jwtDefaultExpiresInSeconds:
    Number(process.env.JWT_DEFAULT_EXPIRES_SECONDS) || 60 * 60 * 72,
  /** Max allowed `expiresInSeconds` in provision request (30d hard cap). */
  jwtMaxExpiresInSeconds:
    Number(process.env.JWT_MAX_EXPIRES_SECONDS) || 60 * 60 * 24 * 30,

  /** Required for `POST /api/provision/token`. Use a long random string in production. */
  adminApiKey: process.env.ADMIN_API_KEY?.trim() ?? "",

  /** JWT secret used for dashboard/admin login tokens (P0-7: must be set in prod). */
  dashboardJwtSecret: requireEnv("DASHBOARD_JWT_SECRET", "dev-only-change-me-dashboard-secret"),
  /** Seeded super-admin credentials for dashboard login (P0-7: must be set in prod). */
  superAdminEmail: (
    requireEnv("SUPER_ADMIN_EMAIL", "admin@disasterrecov.com")
  ).toLowerCase(),
  superAdminPassword: requireEnv("SUPER_ADMIN_PASSWORD", "dev-only-disasterrecov@123"),

  /** Shared bearer token the Flutter app sends on POST /api/data (P0-8). */
  ingestToken: requireEnv("BEACON_INGEST_TOKEN", "dev-only-ingest-token"),
} as const;
