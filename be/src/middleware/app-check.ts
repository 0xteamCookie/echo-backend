import type { RequestHandler } from "express";
import { getAppCheck } from "firebase-admin/app-check";
import { config } from "../lib/config";

/**
 * P2-4: Firebase App Check verification for mobile ingest routes.
 *
 * Mobile clients must attach an App Check token via the `X-Firebase-AppCheck`
 * header. Dashboard JWT routes do NOT require App Check; this middleware is
 * only chained onto `/api/data` + `/api/data/batch` (the mobile ingest path).
 *
 * TODO(mobile): wire the Flutter app to attach `X-Firebase-AppCheck` — see
 *   `echo/lib/online/sync.dart` (HTTP client construction for ingest).
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
    await getAppCheck().verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid App Check token" });
  }
};
