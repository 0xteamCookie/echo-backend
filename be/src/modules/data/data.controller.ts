import type { RequestHandler } from "express";
import { getAllowedAgencies } from "../../middleware/authz";
import { triageAfterIngestSafe } from "../triage/triage-agent.service";
import { dataService } from "./data.service";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
    return Number(v);
  return undefined;
}

function isValidGps(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function parseAgency(value: unknown): "medical" | "fire" | "police" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "medical" || normalized === "fire" || normalized === "police") {
    return normalized;
  }
  return undefined;
}

export const dataController = {
  create: (async (req, res) => {
    const body = req.body;
    if (!isRecord(body)) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    const macAddress = String(body.macAddress ?? "").trim();
    const message = String(body.message ?? "");
    const time = String(body.time ?? "").trim();

    if (!macAddress) {
      res.status(400).json({ error: "macAddress is required" });
      return;
    }
    if (!time) {
      res.status(400).json({ error: "time is required" });
      return;
    }

    const gpsRaw = body.gps;
    const gps =
      isRecord(gpsRaw) && toNumber(gpsRaw.lat) !== undefined && toNumber(gpsRaw.lon) !== undefined
        ? { lat: toNumber(gpsRaw.lat)!, lon: toNumber(gpsRaw.lon)! }
        : undefined;

    if (gps && !isValidGps(gps.lat, gps.lon)) {
      res.status(400).json({ error: "gps.lat and gps.lon must be valid WGS84 coordinates" });
      return;
    }

    const meta = isRecord(body.meta) ? body.meta : undefined;
    const agency = parseAgency(body.agency) ?? parseAgency(meta?.agency) ?? parseAgency(meta?.category);
    const allowedAgencies = getAllowedAgencies(req);
    if (allowedAgencies.length > 0 && agency && !allowedAgencies.includes(agency)) {
      res.status(403).json({ error: "Forbidden: cannot create data outside your agency scope" });
      return;
    }

    const { record, deduplicated } = await dataService.create({
      macAddress,
      message,
      agency: agency ?? (req.user?.role === "super_admin" ? undefined : allowedAgencies[0]),
      time,
      gps,
      meta,
    });

    let finalRecord = record;
    if (!deduplicated) {
      const triaged = await triageAfterIngestSafe(record.id);
      if (triaged) finalRecord = triaged;
    }

    res.status(deduplicated ? 200 : 201);
  }) satisfies RequestHandler,

  heatmap: (async (req, res) => {
    const since = typeof req.query.since === "string" ? req.query.since : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const limitRaw =
      typeof req.query.limit === "string" && req.query.limit.trim() !== ""
        ? Number(req.query.limit)
        : undefined;

    if (since !== undefined && since.trim() !== "" && Number.isNaN(new Date(since).getTime())) {
      res.status(400).json({ error: "since must be a valid ISO8601 datetime" });
      return;
    }

    const points = await dataService.heatmapPoints({
      since: since?.trim() || undefined,
      limit: typeof limitRaw === "number" && Number.isFinite(limitRaw) ? limitRaw : undefined,
      category: category?.trim() || undefined,
      agencies: req.user?.role === "super_admin" ? undefined : getAllowedAgencies(req),
    });

    res.json({ points, polledAt: new Date().toISOString() });
  }) satisfies RequestHandler,

  list: (async (req, res) => {
    const macAddress =
      typeof req.query.macAddress === "string" ? req.query.macAddress : undefined;
    const limit =
      typeof req.query.limit === "string" && req.query.limit.trim() !== ""
        ? Number(req.query.limit)
        : undefined;

    const items = await dataService.list({
      macAddress,
      limit: typeof limit === "number" && Number.isFinite(limit) ? limit : undefined,
      agencies: req.user?.role === "super_admin" ? undefined : getAllowedAgencies(req),
    });

    res.json(items);
  }) satisfies RequestHandler,
};
