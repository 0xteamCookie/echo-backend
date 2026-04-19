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
} as const;
