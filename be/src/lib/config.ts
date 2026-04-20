/** Normalize PEM pasted into `.env` with literal `\n` sequences. */
function pemFromEnv(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\\n/g, "\n").trim();
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite",
  /** Set `TRIAGE_ENABLED=false` to skip Gemini on ingest (faster dummy seeding). */
  // triageEnabled: process.env.TRIAGE_ENABLED !== "false",
  triageEnabled: true,
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
  /** Default lifetime for issued tokens (seconds). Max per-request is capped in service. */
  jwtDefaultExpiresInSeconds: Number(process.env.JWT_DEFAULT_EXPIRES_SECONDS) || 86400 * 365 * 10,
  /** Max allowed `expiresInSeconds` in provision request (default 10 years). */
  jwtMaxExpiresInSeconds: Number(process.env.JWT_MAX_EXPIRES_SECONDS) || 86400 * 365 * 10,

  /** Required for `POST /api/provision/token`. Use a long random string in production. */
  adminApiKey: process.env.ADMIN_API_KEY?.trim() ?? "",

  /** JWT secret used for dashboard/admin login tokens. */
  dashboardJwtSecret: process.env.DASHBOARD_JWT_SECRET?.trim() || "change-me-dashboard-secret",
  /** Seeded super-admin credentials for dashboard login. */
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || "admin@disasterrecov.com",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD?.trim() || "disasterrecov@123",
} as const;
