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

  /**
   * P2-5: Vertex AI config for triage. Auth uses ADC (no API key required).
   * `googleCloudProjectId` falls back to common GCP env vars.
   */
  googleCloudProjectId:
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    "",
  vertexLocation: process.env.VERTEX_LOCATION?.trim() || "us-central1",
  vertexModel:
    process.env.VERTEX_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-1.5-flash",

  /**
   * P2-4: Firebase App Check gate on mobile ingest. Defaults to on in prod,
   * off in dev so local testing without a real Firebase project still works.
   * Mobile clients must attach `X-Firebase-AppCheck` on ingest.
   */
  appCheckEnabled:
    process.env.APP_CHECK_ENABLED !== undefined
      ? process.env.APP_CHECK_ENABLED !== "false"
      : isProd,

  /**
   * P2-1: FCM push dispatch feature flag. Defaults to on in prod, off in dev.
   */
  fcmEnabled:
    process.env.FCM_ENABLED !== undefined
      ? process.env.FCM_ENABLED !== "false"
      : isProd,
  /** Allow browser demos (e.g. `public/demo.html`) to call the API from another origin. */
  corsOrigins: (
    process.env.CORS_ORIGINS?.trim() || "http://localhost:3000"
  )
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),

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

  /**
   * P2-6: Cloud Translation for announcements. When off, `translations` is
   * stored as `{}` and GET falls back to the source text.
   */
  translationEnabled:
    process.env.TRANSLATION_ENABLED !== undefined
      ? process.env.TRANSLATION_ENABLED !== "false"
      : isProd,
  translationTargetLangs: (
    process.env.TRANSLATION_TARGET_LANGS?.trim() ||
    "en,es,fr,de,zh,hi,ar,pt,ja,ko"
  )
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),

  /**
   * P2-8: Pub/Sub fan-out for ingested beacon records. When enabled, each
   * non-duplicate ingest is published to `pubsubTopicIngest`; Cloud Run
   * subscribers can then do triage, BigQuery streaming, etc.
   */
  pubsubEnabled:
    process.env.PUBSUB_ENABLED !== undefined
      ? process.env.PUBSUB_ENABLED !== "false"
      : isProd,
  pubsubTopicIngest: process.env.PUBSUB_TOPIC_INGEST?.trim() || "beacon-ingest",
  /** Shared secret required on `POST /api/pubsub/triage-push` (Pub/Sub push auth). */
  pubsubPushToken: process.env.PUBSUB_PUSH_TOKEN?.trim() ?? "",
  /** When true, inline triage after ingest is skipped; a Pub/Sub worker handles it. */
  triageAsync: process.env.TRIAGE_ASYNC === "true",

  /**
   * P2-9: BigQuery streaming for Looker Studio agency reports. When enabled,
   * each non-duplicate ingest is streamed into `bigqueryDataset.bigqueryTable`.
   */
  bigqueryEnabled:
    process.env.BIGQUERY_ENABLED !== undefined
      ? process.env.BIGQUERY_ENABLED !== "false"
      : isProd,
  bigqueryDataset: process.env.BIGQUERY_DATASET?.trim() || "beacon",
  bigqueryTable: process.env.BIGQUERY_TABLE?.trim() || "events",

  /**
   * P2-10: Distance Matrix-based dispatch. When off, dispatch ranks by
   * haversine distance only.
   */
  distanceMatrixEnabled:
    process.env.DISTANCE_MATRIX_ENABLED !== undefined
      ? process.env.DISTANCE_MATRIX_ENABLED !== "false"
      : isProd,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "",
} as const;
