import type { RequestHandler } from "express";
import { getAppCheck } from "firebase-admin/app-check";
import { config } from "../lib/config";
import { ensureFirebaseApp } from "../lib/firebase";

/**
 * P2-4: Firebase App Check verification for mobile ingest routes.
 *
 * Mobile clients must attach an App Check token via the `X-Firebase-AppCheck`
 * header. Dashboard JWT routes do NOT require App Check; this middleware is
 * only chained onto `/api/data` + `/api/data/batch` (the mobile ingest path).
 *
 * The Flutter app attaches `X-Firebase-AppCheck` from its ingest HTTP client —
 * see `echo/lib/online/sync.dart` (_ingestHeaders).
 *
 * When `config.appCheckEnabled === false` (default in dev) the middleware is
 * a pass-through so local harnesses without a real Firebase project still
 * function.
 */
export const requireAppCheck: RequestHandler = async (req, res, next) => {
  if (!config.appCheckEnabled) {
    next();
    return;
  }
  const header = req.header("x-firebase-appcheck");
  const token = typeof header === "string" ? header.trim() : "";
  if (!token) {
    res.status(401).json({ error: "Missing X-Firebase-AppCheck token" });
    return;
  }
  try {
    // Ensure the default Firebase app is initialized before getAppCheck().
    // A token-bearing ingest request may never have touched Firestore/Auth, so
    // the default app could otherwise be uninitialized here.
    ensureFirebaseApp();
    await getAppCheck().verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid App Check token" });
  }
};
