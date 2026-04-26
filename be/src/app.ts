import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getProvisioningPublicJwk } from "./lib/jwt-provisioning";
import { config } from "./lib/config";
import { log } from "./lib/logger";
import { getFirestoreDb } from "./lib/firebase";
import { errorHandler } from "./middleware/error-handler";
import { identifyUser } from "./middleware/authz";
import { accountRouter } from "./modules/account/account.routes";
import { announcementRouter } from "./modules/announcement/announcement.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { dataRouter } from "./modules/data/data.routes";
import { dispatchRouter } from "./modules/dispatch/dispatch.routes";
import { provisionRouter } from "./modules/provision/provision.routes";
import { pubsubRouter } from "./modules/pubsub/pubsub.routes";
import { pushRouter } from "./modules/push/push.routes";
import { rescuerRouter } from "./modules/rescuer/rescuer.routes";

export const app = express();

// Trust the first proxy hop (nginx/Caddy/load-balancer) so that
// X-Forwarded-For is used correctly by express-rate-limit and Express itself.
// Value of 1 means: trust one proxy layer in front of Node.
app.set("trust proxy", 1);

// P3-12: defense-in-depth headers before any other middleware.
app.use(helmet());

// P3-11: CORS allowlist. Reject unknown origins; allow same-origin / curl
// (no Origin header) so health checks still pass.
const allowedOrigins = new Set(config.corsOrigins);
if (config.nodeEnv !== "production") {
  // Always allow local frontend dev origins, even if CORS_ORIGINS is stale.
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://localhost:3001");
}
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);

// P3-12: cap JSON bodies. Beacon ingest payloads are tiny; 32kb is plenty and
// blocks accidental/malicious bulk posts.
app.use(express.json({ limit: "32kb" }));

// P3-12: global rate limit — 300 req/min/IP. Prevents brute-forcing auth
// endpoints and basic scraping.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use(globalLimiter);

// Tighter limit on the ingest path specifically.
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use("/api/data", ingestLimiter);

// P3-9: liveness probe. Always returns 200 if the process is responsive.
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

// P3-9: readiness probe. Verifies Firestore connectivity with a small,
// timeout-bounded call so Cloud Run can decide when to route traffic.
app.get("/readyz", async (_req, res) => {
  const timeoutMs = 2000;
  try {
    const db = getFirestoreDb();
    await Promise.race([
      db.listCollections(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("firestore_timeout")), timeoutMs),
      ),
    ]);
    res.status(200).json({ ok: true });
  } catch (err) {
    log.warn("readyz.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(503).json({ ok: false });
  }
});

/** Public JWKS for rescuer apps verifying RS256 tokens offline or online. */
app.get("/.well-known/jwks.json", async (_req, res) => {
  try {
    const jwk = await getProvisioningPublicJwk();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({ keys: [jwk] });
  } catch {
    res.status(503).json({
      error: "JWKS not available (configure FIREBASE_SERVICE_ACCOUNT_JSON)",
    });
  }
});

app.use(identifyUser);

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.use("/api/auth", authRouter);
app.use("/api/provision", provisionRouter);
app.use("/api/account", accountRouter);
app.use("/api/announcement", announcementRouter);
app.use("/api/data", dataRouter);
app.use("/api/dispatch", dispatchRouter);
app.use("/api/push", pushRouter);
app.use("/api/rescuer", rescuerRouter);
app.use("/api/pubsub", pubsubRouter);

app.use(errorHandler);
