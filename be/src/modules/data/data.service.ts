import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { FieldValue, getFirestoreDb } from "../../lib/firebase";
import { categoriesFromTriageMeta } from "../triage/triage.schema";
import type { AgencyScope, CreateDeviceDataBody, DeviceData, HeatmapPoint } from "./data.schema";

const COLLECTION = "device_entries";

/** Same window as ingestion dedup in the architecture doc (~30s). */
const DEDUP_WINDOW_MS = 30_000;

const dedupCache = new Map<string, { id: string; expiresAt: number }>();

function pruneDedupCache(): void {
  const now = Date.now();
  for (const [k, v] of dedupCache) {
    if (v.expiresAt <= now) dedupCache.delete(k);
  }
}

function shortHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function dedupKeyFromPayload(payload: CreateDeviceDataBody): string {
  const mac = normalizeMac(payload.macAddress);
  const meta = payload.meta;
  const messageId =
    meta && typeof meta.messageId === "string" && meta.messageId.trim() !== ""
      ? meta.messageId.trim()
      : undefined;
  if (messageId) return `${mac}:${messageId}`;
  return `${mac}:${shortHash(`${payload.message}\0${payload.time}`)}`;
}

const CATEGORY_WEIGHT: Record<string, number> = {
  medical: 1.0,
  fire: 1.5,
  police: 1.0,
  rescue: 1.2,
  broadcast: 0.8,
  unknown: 0.5,
};

function categoryMultiplier(category: string): number {
  return CATEGORY_WEIGHT[category] ?? CATEGORY_WEIGHT.unknown;
}

function triageFromMeta(meta?: Record<string, unknown>): { severity: number; categories: string[] } {
  let severity = 1;
  let categories: string[] = ["unknown"];

  const triage = meta?.triage;
  if (triage && typeof triage === "object" && !Array.isArray(triage)) {
    const t = triage as Record<string, unknown>;
    if (typeof t.severity === "number" && Number.isFinite(t.severity)) {
      severity = Math.min(5, Math.max(1, Math.round(t.severity)));
    }
    categories = categoriesFromTriageMeta(triage);
  } else if (meta && typeof meta.category === "string" && meta.category.trim() !== "") {
    categories = meta.category
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x !== "");
    if (categories.length === 0) categories = ["unknown"];
  }

  if (meta && typeof meta.severity === "number" && Number.isFinite(meta.severity)) {
    severity = Math.min(5, Math.max(1, Math.round(meta.severity)));
  }

  return { severity, categories };
}

function locationNameFromMeta(meta?: Record<string, unknown>): string | undefined {
  if (!meta) return undefined;
  const candidates = [meta.locationName, meta.location, meta.locationLabel, meta.placeName];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim().slice(0, 120);
    }
  }
  return undefined;
}

function heatmapPointFromDevice(d: DeviceData): HeatmapPoint | null {
  if (!d.gps) return null;
  const { severity, categories } = triageFromMeta(d.meta);
  const maxMult = Math.max(
    ...categories.map((c) => categoryMultiplier(c)),
    CATEGORY_WEIGHT.unknown,
  );
  const weight = severity * maxMult;
  return {
    id: d.id,
    lat: d.gps.lat,
    lon: d.gps.lon,
    locationName: locationNameFromMeta(d.meta),
    weight,
    categories,
    category: categories.join(", "),
    severity,
    receivedAt: d.receivedAt,
    macAddress: d.macAddress,
    agency: d.agency,
  };
}

function normalizeMac(input: string): string {
  return input.trim().toLowerCase();
}

function parseAgencyScope(value: unknown): AgencyScope | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "medical" || normalized === "fire" || normalized === "police") {
    return normalized;
  }
  return undefined;
}

function inferAgency(meta?: Record<string, unknown>): AgencyScope | undefined {
  const directAgency = parseAgencyScope(meta?.agency);
  if (directAgency) return directAgency;
  const directCategory = parseAgencyScope(meta?.category);
  if (directCategory) return directCategory;

  const triage = meta?.triage;
  if (triage && typeof triage === "object" && !Array.isArray(triage)) {
    const categories = categoriesFromTriageMeta(triage);
    for (const category of categories) {
      const agency = parseAgencyScope(category);
      if (agency) return agency;
    }
  }

  return undefined;
}

function timestampToIso(v: unknown): string {
  if (
    v &&
    typeof v === "object" &&
    "toDate" in v &&
    typeof (v as Timestamp).toDate === "function"
  ) {
    return (v as Timestamp).toDate().toISOString();
  }
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

/** Ensure `meta.triage.categories` is always a normalized array for API clients. */
function normalizeMeta(raw: Record<string, unknown>): Record<string, unknown> {
  const meta = { ...raw };
  const tri = meta.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    meta.triage = {
      ...(tri as Record<string, unknown>),
      categories: categoriesFromTriageMeta(tri),
    };
  }
  return meta;
}

function docToDevice(id: string, data: FirebaseFirestore.DocumentData): DeviceData {
  const rawGps = data.gps;
  const gps =
    rawGps &&
    typeof rawGps === "object" &&
    typeof rawGps.lat === "number" &&
    typeof rawGps.lon === "number"
      ? { lat: rawGps.lat, lon: rawGps.lon }
      : undefined;

  const rawMeta = data.meta;
  const meta =
    rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
      ? normalizeMeta(rawMeta as Record<string, unknown>)
      : undefined;

  return {
    id,
    macAddress: String(data.macAddress ?? ""),
    message: String(data.message ?? ""),
    agency: parseAgencyScope(data.agency),
    time: String(data.time ?? ""),
    gps,
    meta,
    receivedAt: timestampToIso(data.receivedAt),
  };
}

export const dataService = {
  async create(
    payload: CreateDeviceDataBody,
  ): Promise<{ record: DeviceData; deduplicated: boolean }> {
    pruneDedupCache();
    const key = dedupKeyFromPayload(payload);
    const cached = dedupCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      const db = getFirestoreDb();
      const snap = await db.collection(COLLECTION).doc(cached.id).get();
      if (snap.exists) {
        return {
          record: docToDevice(cached.id, snap.data()!),
          deduplicated: true,
        };
      }
      dedupCache.delete(key);
    }

    const db = getFirestoreDb();
    const id = crypto.randomUUID();
    const ref = db.collection(COLLECTION).doc(id);
    await ref.set({
      macAddress: normalizeMac(payload.macAddress),
      message: payload.message,
      agency: payload.agency ?? inferAgency(payload.meta) ?? null,
      time: payload.time,
      gps: payload.gps ?? null,
      meta: payload.meta ?? null,
      receivedAt: FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    const data = snap.data();
    if (!data) {
      throw new Error("Failed to read device entry after write");
    }
    dedupCache.set(key, { id, expiresAt: Date.now() + DEDUP_WINDOW_MS });
    return { record: docToDevice(id, data), deduplicated: false };
  },

  async getById(id: string): Promise<DeviceData | null> {
    const db = getFirestoreDb();
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return docToDevice(id, snap.data()!);
  },

  /**
   * Shallow-merge keys into `meta`. When `patch` includes `triage`, clears `triageError`.
   */
  async mergeDeviceMeta(id: string, patch: Record<string, unknown>): Promise<DeviceData> {
    const db = getFirestoreDb();
    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error("Device entry not found");
    }
    const data = snap.data()!;
    const rawMeta = data.meta;
    const existingMeta =
      rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
        ? { ...(rawMeta as Record<string, unknown>) }
        : {};
    const merged: Record<string, unknown> = { ...existingMeta, ...patch };
    if (patch.triage) {
      delete merged.triageError;
    }
    await ref.update({ meta: merged });
    const next = await ref.get();
    const nd = next.data();
    if (!nd) {
      throw new Error("Failed to read device entry after meta merge");
    }
    return docToDevice(id, nd);
  },

  /** Recent rows (newest first) with GPS — used for nearby-incident context in triage. */
  async listRecentWithGps(max: number): Promise<DeviceData[]> {
    const db = getFirestoreDb();
    const cap = Math.min(500, Math.max(1, max));
    const q = db.collection(COLLECTION).orderBy("receivedAt", "desc").limit(cap);
    const snap = await q.get();
    return snap.docs.map((d) => docToDevice(d.id, d.data())).filter((d) => d.gps !== undefined);
  },

  /**
   * Points with GPS for dashboard heatmap layers. Poll on an interval instead of WebSockets.
   * Optional `since` (ISO8601) returns rows with receivedAt after that time (ascending).
   */
  async heatmapPoints(filter?: {
    since?: string;
    limit?: number;
    category?: string;
    agencies?: AgencyScope[];
  }): Promise<HeatmapPoint[]> {
    const db = getFirestoreDb();
    const limit = Math.max(1, Math.min(500, filter?.limit ?? 200));
    const col = db.collection(COLLECTION);
    const categoryFilter = filter?.category?.trim().toLowerCase();

    let q: FirebaseFirestore.Query;
    if (filter?.since) {
      const d = new Date(filter.since);
      if (Number.isNaN(d.getTime())) {
        return [];
      }
      q = col
        .where("receivedAt", ">", Timestamp.fromDate(d))
        .orderBy("receivedAt", "asc")
        .limit(limit);
    } else {
      q = col.orderBy("receivedAt", "desc").limit(limit);
    }

    const snap = await q.get();
    const devices = snap.docs.map((d) => docToDevice(d.id, d.data()));
    let points = devices
      .map(heatmapPointFromDevice)
      .filter((p): p is HeatmapPoint => p !== null);

    if (filter?.agencies && filter.agencies.length > 0) {
      const allowedAgencies = new Set(filter.agencies);
      points = points.filter((point) => point.agency && allowedAgencies.has(point.agency));
    }

    if (categoryFilter) {
      points = points.filter((p) => p.categories.includes(categoryFilter));
    }

    return points;
  },

  async list(filter?: {
    macAddress?: string;
    limit?: number;
    agencies?: AgencyScope[];
  }): Promise<DeviceData[]> {
    const db = getFirestoreDb();
    const limit = Math.max(0, Math.min(1000, filter?.limit ?? 100));
    const mac = filter?.macAddress ? normalizeMac(filter.macAddress) : undefined;

    const q: FirebaseFirestore.Query = mac
      ? db
          .collection(COLLECTION)
          .where("macAddress", "==", mac)
          .orderBy("receivedAt", "desc")
          .limit(limit)
      : db.collection(COLLECTION).orderBy("receivedAt", "desc").limit(limit);

    const snap = await q.get();
    const items = snap.docs.map((d) => docToDevice(d.id, d.data()));
    if (!filter?.agencies || filter.agencies.length === 0) return items;
    const allowedAgencies = new Set(filter.agencies);
    return items.filter((item) => item.agency && allowedAgencies.has(item.agency));
  },

  /**
   * Update the triage/operational status of a device entry. Stored on the
   * document itself (not inside `meta`) so the admin UI can filter by status
   * without parsing nested fields.
   */
  async setStatus(params: {
    id: string;
    status: "acknowledged" | "resolved" | "assigned" | "pending";
    actorId: string;
    actorEmail?: string;
  }): Promise<DeviceData & { status: string }> {
    const db = getFirestoreDb();
    const ref = db.collection(COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw Object.assign(new Error("Device entry not found"), { statusCode: 404 });
    }
    const now = new Date().toISOString();
    await ref.set(
      {
        status: params.status,
        statusUpdatedAt: now,
        statusUpdatedBy: params.actorId,
        statusUpdatedByEmail: params.actorEmail ?? null,
      },
      { merge: true },
    );
    const next = await ref.get();
    const nd = next.data();
    if (!nd) {
      throw new Error("Failed to read device entry after status update");
    }
    return { ...docToDevice(params.id, nd), status: params.status };
  },
};
