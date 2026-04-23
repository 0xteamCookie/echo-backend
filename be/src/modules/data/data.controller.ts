import type { RequestHandler } from "express";
import { config } from "../../lib/config";
import { getAllowedAgencies } from "../../middleware/authz";
import { streamEvent } from "../bigquery/bigquery.service";
import { publishIngest } from "../pubsub/pubsub.service";
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
      // P2-8/P2-9: fan-out new records to Pub/Sub + BigQuery. Fire-and-forget
      // (service modules swallow errors) so ingest latency stays predictable.
      void publishIngest(record);
      void streamEvent(record);

      // When `triageAsync` is on, the Pub/Sub worker runs triage; skip inline.
      if (!config.triageAsync) {
        const triaged = await triageAfterIngestSafe(record.id);
        if (triaged) finalRecord = triaged;
      }
    }

    // P0-5: always emit a JSON body so clients can confirm ingest + read id.
    res.status(deduplicated ? 200 : 201).json({
      ok: true,
      deduplicated,
      messageId: finalRecord.id,
      record: finalRecord,
    });
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

  // P2-12: batch ingest for relayers returning from an outage with queued packets.
  // Accepts `{ packets: Array<BodyShape> }` up to 500 per request; each packet is
  // validated + dedup'd by dataService (same unique-key logic as single ingest).
  // Triage is fire-and-forget so a 500-item batch returns quickly.
  createBatch: (async (req, res) => {
    const body = req.body;
    if (!isRecord(body)) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    const packets = body.packets;
    if (!Array.isArray(packets)) {
      res.status(400).json({ error: "packets must be an array" });
      return;
    }
    if (packets.length === 0) {
      res.status(400).json({ error: "packets must not be empty" });
      return;
    }
    if (packets.length > 500) {
      res.status(413).json({ error: "batch too large (max 500 packets)" });
      return;
    }

    const allowedAgencies = getAllowedAgencies(req);
    const results: Array<{
      index: number;
      ok: boolean;
      messageId?: string;
      deduplicated?: boolean;
      error?: string;
    }> = [];

    // Process sequentially to keep Firestore write pressure bounded and to keep
    // dedup ordering deterministic within a batch.
    for (let i = 0; i < packets.length; i++) {
      const p = packets[i];
      try {
        if (!isRecord(p)) {
          results.push({ index: i, ok: false, error: "not an object" });
          continue;
        }
        const macAddress = String(p.macAddress ?? "").trim();
        const message = String(p.message ?? "");
        const time = String(p.time ?? "").trim();
        if (!macAddress) {
          results.push({ index: i, ok: false, error: "macAddress required" });
          continue;
        }
        if (!time) {
          results.push({ index: i, ok: false, error: "time required" });
          continue;
        }

        const gpsRaw = p.gps;
        const gps =
          isRecord(gpsRaw) &&
          toNumber(gpsRaw.lat) !== undefined &&
          toNumber(gpsRaw.lon) !== undefined
            ? { lat: toNumber(gpsRaw.lat)!, lon: toNumber(gpsRaw.lon)! }
            : undefined;
        if (gps && !isValidGps(gps.lat, gps.lon)) {
          results.push({ index: i, ok: false, error: "invalid gps" });
          continue;
        }

        const meta = isRecord(p.meta) ? p.meta : undefined;
        const agency =
          parseAgency(p.agency) ?? parseAgency(meta?.agency) ?? parseAgency(meta?.category);
        if (allowedAgencies.length > 0 && agency && !allowedAgencies.includes(agency)) {
          results.push({ index: i, ok: false, error: "agency outside scope" });
          continue;
        }

        const { record, deduplicated } = await dataService.create({
          macAddress,
          message,
          agency: agency ?? (req.user?.role === "super_admin" ? undefined : allowedAgencies[0]),
          time,
          gps,
          meta,
        });

        // Fire-and-forget triage; don't await to keep batch latency reasonable.
        if (!deduplicated) {
          // P2-8/P2-9: same fan-out as single ingest.
          void publishIngest(record);
          void streamEvent(record);
          if (!config.triageAsync) {
            void triageAfterIngestSafe(record.id);
          }
        }

        results.push({
          index: i,
          ok: true,
          messageId: record.id,
          deduplicated,
        });
      } catch (err) {
        results.push({
          index: i,
          ok: false,
          error: err instanceof Error ? err.message : "unknown error",
        });
      }
    }

    const accepted = results.filter((r) => r.ok).length;
    const duplicates = results.filter((r) => r.ok && r.deduplicated).length;
    res.status(202).json({
      ok: true,
      total: packets.length,
      accepted,
      duplicates,
      rejected: packets.length - accepted,
      results,
    });
  }) satisfies RequestHandler,

  updateStatus: (async (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }
    const body = req.body;
    const statusRaw = isRecord(body) && typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const allowed = new Set(["acknowledged", "resolved", "assigned", "pending"]);
    if (!allowed.has(statusRaw)) {
      res.status(400).json({
        error: `status must be one of: ${[...allowed].join(", ")}`,
      });
      return;
    }
    try {
      const updated = await dataService.setStatus({
        id,
        status: statusRaw as "acknowledged" | "resolved" | "assigned" | "pending",
        actorId: req.user.id,
        actorEmail: req.user.email,
      });
      res.json(updated);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Status update failed";
      res.status(status).json({ error: message });
    }
  }) satisfies RequestHandler,
};
