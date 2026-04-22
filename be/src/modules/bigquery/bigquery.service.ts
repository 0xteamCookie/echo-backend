// P2-9: Stream ingested beacon events to BigQuery for Looker Studio reports.
// Fire-and-forget; any error is swallowed so BQ outages don't block ingest.
import { BigQuery } from "@google-cloud/bigquery";
import { config } from "../../lib/config";
import type { DeviceData } from "../data/data.schema";

let client: BigQuery | null = null;

function getClient(): BigQuery {
  if (!client) {
    client = new BigQuery(
      config.googleCloudProjectId
        ? { projectId: config.googleCloudProjectId }
        : {},
    );
  }
  return client;
}

type EventRow = {
  id: string;
  receivedAt: string;
  time: string;
  macAddress: string;
  agency: string | null;
  severity: number | null;
  categories: string[];
  gpsLat: number | null;
  gpsLng: number | null;
  hopCount: number | null;
  messageLen: number;
};

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function categoriesFromMeta(meta: Record<string, unknown> | undefined): string[] {
  const tri = meta?.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    const raw = (tri as Record<string, unknown>).categories;
    if (Array.isArray(raw)) {
      return raw.map((x) => String(x)).filter((s) => s.trim() !== "");
    }
  }
  if (meta && typeof meta.category === "string" && meta.category.trim() !== "") {
    return meta.category
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
  }
  return [];
}

function severityFromMeta(meta: Record<string, unknown> | undefined): number | null {
  const tri = meta?.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    const raw = (tri as Record<string, unknown>).severity;
    const n = toNumberOrNull(raw);
    if (n !== null) return Math.min(5, Math.max(1, Math.round(n)));
  }
  const direct = toNumberOrNull(meta?.severity);
  if (direct !== null) return Math.min(5, Math.max(1, Math.round(direct)));
  return null;
}

function rowFromRecord(record: DeviceData): EventRow {
  const hopCount = toNumberOrNull(record.meta?.hopCount);
  return {
    id: record.id,
    receivedAt: record.receivedAt,
    time: record.time,
    macAddress: record.macAddress,
    agency: record.agency ?? null,
    severity: severityFromMeta(record.meta),
    categories: categoriesFromMeta(record.meta),
    gpsLat: record.gps ? record.gps.lat : null,
    gpsLng: record.gps ? record.gps.lon : null,
    hopCount,
    messageLen: record.message.length,
  };
}

/**
 * Stream one event row into `${bigqueryDataset}.${bigqueryTable}`.
 * Errors are logged and swallowed.
 */
export async function streamEvent(record: DeviceData): Promise<void> {
  if (!config.bigqueryEnabled) return;
  try {
    const row = rowFromRecord(record);
    await getClient()
      .dataset(config.bigqueryDataset)
      .table(config.bigqueryTable)
      .insert([row], { skipInvalidRows: false });
  } catch (err) {
    console.warn(
      "[bigquery] streamEvent failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
