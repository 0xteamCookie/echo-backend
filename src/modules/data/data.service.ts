import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { FieldValue, getFirestoreDb } from "../../lib/firebase";
import type { CreateDeviceDataBody, DeviceData, HeatmapPoint } from "./data.schema";

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

function triageFromMeta(meta?: Record<string, unknown>): { severity: number; category: string } {
  let severity = 1;
  let category = "unknown";

  const triage = meta?.triage;
  if (triage && typeof triage === "object" && !Array.isArray(triage)) {
    const t = triage as Record<string, unknown>;
    const s = t.severity;
    const c = t.category;
    if (typeof s === "number" && Number.isFinite(s)) {
      severity = Math.min(5, Math.max(1, Math.round(s)));
    }
    if (typeof c === "string" && c.trim() !== "") category = c.trim().toLowerCase();
  }

  if (meta && typeof meta.severity === "number" && Number.isFinite(meta.severity)) {
    severity = Math.min(5, Math.max(1, Math.round(meta.severity)));
  }
  if (meta && typeof meta.category === "string" && meta.category.trim() !== "") {
    category = meta.category.trim().toLowerCase();
  }

  return { severity, category };
}

function heatmapPointFromDevice(d: DeviceData): HeatmapPoint | null {
  if (!d.gps) return null;
  const { severity, category } = triageFromMeta(d.meta);
  const weight = severity * categoryMultiplier(category);
  return {
    id: d.id,
    lat: d.gps.lat,
    lon: d.gps.lon,
    weight,
    category,
    severity,
    receivedAt: d.receivedAt,
    macAddress: d.macAddress,
  };
}

function normalizeMac(input: string): string {
  return input.trim().toLowerCase();
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
      ? (rawMeta as Record<string, unknown>)
      : undefined;

  return {
    id,
    macAddress: String(data.macAddress ?? ""),
    message: String(data.message ?? ""),
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

    if (categoryFilter) {
      points = points.filter((p) => p.category === categoryFilter);
    }

    return points;
  },

  async list(filter?: { macAddress?: string; limit?: number }): Promise<DeviceData[]> {
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
    return snap.docs.map((d) => docToDevice(d.id, d.data()));
  },
};
