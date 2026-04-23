import type { RequestHandler } from "express";
import { announcementService } from "./announcement.service";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return undefined;
}

function isValidGps(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export const announcementController = {
  create: (async (req, res) => {
    const body = req.body;
    if (!isRecord(body)) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    // P2-6: accept either `message` or `body` (new field name).
    const message = String(body.message ?? body.body ?? "").trim();
    const locationName = String(body.locationName ?? "").trim();
    const title =
      typeof body.title === "string" && body.title.trim() !== "" ? body.title.trim() : undefined;
    const agencyRaw = typeof body.agency === "string" ? body.agency.trim().toLowerCase() : "";
    const agency =
      agencyRaw === "medical" || agencyRaw === "fire" || agencyRaw === "police"
        ? (agencyRaw as "medical" | "fire" | "police")
        : undefined;
    const gpsRaw = body.gps;
    const gps =
      isRecord(gpsRaw) && toNumber(gpsRaw.lat) !== undefined && toNumber(gpsRaw.lon) !== undefined
        ? { lat: toNumber(gpsRaw.lat)!, lon: toNumber(gpsRaw.lon)! }
        : undefined;

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    if (!locationName) {
      res.status(400).json({ error: "locationName is required" });
      return;
    }
    if (!gps || !isValidGps(gps.lat, gps.lon)) {
      res.status(400).json({ error: "gps.lat and gps.lon must be valid WGS84 coordinates" });
      return;
    }

    const announcement = await announcementService.create(
      {
        message,
        locationName,
        gps,
        title,
        agency,
      },
      req.user?.id,
    );

    res.status(201).json(announcement);
  }) satisfies RequestHandler,

  listNearby: (async (req, res) => {
    const latRaw = req.query.lat;
    const lonRaw = req.query.long ?? req.query.lon;
    const limitRaw = req.query.limit;
    const langRaw = req.query.lang;
    const lang =
      typeof langRaw === "string" && langRaw.trim() !== "" ? langRaw.trim() : undefined;

    const lat = toNumber(latRaw);
    const lon = toNumber(lonRaw);
    const limit = toNumber(limitRaw);

    // P2-6: when no coordinates are supplied, return the latest 50 instead of
    // rejecting. Keeps the endpoint usable for translated feeds in the admin UI.
    if (lat === undefined && lon === undefined) {
      const latest = await announcementService.listLatest({
        lang,
        limit: typeof limit === "number" && Number.isFinite(limit) ? limit : 50,
      });
      res.json({
        announcements: latest,
        fetchedAt: new Date().toISOString(),
      });
      return;
    }

    if (lat === undefined || lon === undefined || !isValidGps(lat, lon)) {
      res.status(400).json({ error: "lat and long must be valid WGS84 coordinates" });
      return;
    }

    const announcements = await announcementService.listNearby({
      lat,
      lon,
      limit: typeof limit === "number" && Number.isFinite(limit) ? limit : undefined,
      lang,
    });

    res.json({
      radiusM: 1000,
      announcements,
      fetchedAt: new Date().toISOString(),
    });
  }) satisfies RequestHandler,
};
