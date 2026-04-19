import type { RequestHandler } from "express";
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

    const meta = isRecord(body.meta) ? body.meta : undefined;

    const record = await dataService.create({
      macAddress,
      message,
      time,
      gps,
      meta,
    });

    res.status(201).json(record);
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
    });

    res.json(items);
  }) satisfies RequestHandler,
};
