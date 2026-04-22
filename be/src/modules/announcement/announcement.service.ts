import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { FieldValue, getFirestoreDb } from "../../lib/firebase";
import { haversineMeters } from "../../lib/geo";
import type { Announcement, CreateAnnouncementBody } from "./announcement.schema";

const COLLECTION = "announcements";
const ANNOUNCEMENT_RADIUS_M = 1000;

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

function docToAnnouncement(id: string, data: FirebaseFirestore.DocumentData): Announcement {
  return {
    id,
    message: String(data.message ?? ""),
    locationName: String(data.locationName ?? ""),
    gps: {
      lat: Number(data.gps?.lat ?? 0),
      lon: Number(data.gps?.lon ?? 0),
    },
    createdAt: timestampToIso(data.createdAt),
    createdBy: typeof data.createdBy === "string" && data.createdBy.trim() !== "" ? data.createdBy : undefined,
  };
}

export const announcementService = {
  async create(payload: CreateAnnouncementBody, userId?: string): Promise<Announcement> {
    const db = getFirestoreDb();
    const id = crypto.randomUUID();
    const ref = db.collection(COLLECTION).doc(id);

    await ref.set({
      message: payload.message,
      locationName: payload.locationName,
      gps: payload.gps,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: userId ?? null,
    });

    const snap = await ref.get();
    const data = snap.data();
    if (!data) {
      throw new Error("Failed to read announcement after write");
    }
    return docToAnnouncement(id, data);
  },

  async listNearby(params: { lat: number; lon: number; limit?: number }): Promise<Announcement[]> {
    const db = getFirestoreDb();
    const limit = Math.max(1, Math.min(200, params.limit ?? 100));
    const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").limit(limit).get();
    const items = snap.docs.map((doc) => docToAnnouncement(doc.id, doc.data()));

    return items.filter(
      (item) =>
        haversineMeters(
          { lat: params.lat, lon: params.lon },
          { lat: item.gps.lat, lon: item.gps.lon },
        ) <= ANNOUNCEMENT_RADIUS_M,
    );
  },
};
