import crypto from "node:crypto";
import type { Timestamp } from "firebase-admin/firestore";
import { FieldValue, getFirestoreDb } from "../../lib/firebase";
import type { CreateDeviceDataBody, DeviceData } from "./data.schema";

const COLLECTION = "device_entries";

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
  async create(payload: CreateDeviceDataBody): Promise<DeviceData> {
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
    return docToDevice(id, data);
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
