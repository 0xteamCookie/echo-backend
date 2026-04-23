import { Router } from "express";
import type { RequestHandler } from "express";
import { requireRescuerJwt } from "../../middleware/rescuer-jwt";
import { getFirestoreDb } from "../../lib/firebase";
import { log } from "../../lib/logger";

export const rescuerRouter = Router();

/**
 * POST /api/rescuer/heartbeat
 *
 * Rescuer apps call this periodically (e.g. every 2 minutes while on duty) to
 * keep the `rescuers/{sub}` Firestore document fresh. The dispatch engine
 * queries this collection with `onDuty == true` and reads `currentLocation`
 * to rank nearby responders, so the document MUST exist and be current for
 * the AI dispatch recommendations to pick the rescuer.
 *
 * Auth is the RS256 rescuer provisioning JWT (same token scanned via QR).
 * Body:
 *   {
 *     currentLocation: { lat: number, lng: number },
 *     onDuty?: boolean,               // default true (calling means on-duty)
 *     specialties?: string[],
 *     batteryPct?: number             // optional telemetry
 *   }
 */
const heartbeat: RequestHandler = async (req, res) => {
  const rescuer = req.rescuer;
  if (!rescuer) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  const rec = body as Record<string, unknown>;

  const loc = rec.currentLocation;
  if (!loc || typeof loc !== "object" || Array.isArray(loc)) {
    res.status(400).json({ error: "currentLocation { lat, lng } is required" });
    return;
  }
  const latRaw = (loc as Record<string, unknown>).lat;
  const lngRaw = (loc as Record<string, unknown>).lng;
  const lat = typeof latRaw === "number" ? latRaw : Number(latRaw);
  const lng = typeof lngRaw === "number" ? lngRaw : Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: "currentLocation must be valid WGS84 coordinates" });
    return;
  }

  const onDuty = rec.onDuty === undefined ? true : rec.onDuty === true;
  const specialties = Array.isArray(rec.specialties)
    ? rec.specialties
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v !== "")
        .slice(0, 20)
    : undefined;
  const batteryPct =
    typeof rec.batteryPct === "number" && Number.isFinite(rec.batteryPct)
      ? Math.max(0, Math.min(100, Math.round(rec.batteryPct)))
      : undefined;

  const agency =
    rescuer.agency === "medical" || rescuer.agency === "fire" || rescuer.agency === "police"
      ? rescuer.agency
      : null;
  const name = typeof rescuer.name === "string" && rescuer.name ? rescuer.name : rescuer.sub;

  const db = getFirestoreDb();
  const doc: Record<string, unknown> = {
    name,
    agency,
    currentLocation: { lat, lng },
    onDuty,
    lastSeenAt: new Date().toISOString(),
  };
  if (specialties !== undefined) doc.specialties = specialties;
  if (batteryPct !== undefined) doc.batteryPct = batteryPct;

  try {
    await db.collection("rescuers").doc(rescuer.sub).set(doc, { merge: true });
    res.status(204).send();
  } catch (err) {
    log.warn("rescuer.heartbeat.failed", {
      sub: rescuer.sub,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "heartbeat write failed" });
  }
};

rescuerRouter.post("/heartbeat", requireRescuerJwt, heartbeat);
