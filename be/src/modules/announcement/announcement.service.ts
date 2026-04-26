import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { FieldValue, getFirestoreDb } from "../../lib/firebase";
import { haversineMeters } from "../../lib/geo";
import type {
  Announcement,
  CreateAnnouncementBody,
} from "./announcement.schema";
import { translateForAll } from "./translation.service";

const COLLECTION = "announcements";
const ANNOUNCEMENT_RADIUS_M = 1000;

type AgencyScope = "medical" | "fire" | "police";

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

function parseAgency(value: unknown): AgencyScope | undefined {
  if (typeof value !== "string") return undefined;
  const n = value.trim().toLowerCase();
  if (n === "medical" || n === "fire" || n === "police") return n;
  return undefined;
}

function normalizeTranslations(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim() !== "") out[k] = v;
  }
  return out;
}

function docToAnnouncement(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Announcement {
  const title =
    typeof data.title === "string" && data.title.trim() !== ""
      ? data.title
      : undefined;
  const createdBy =
    typeof data.createdBy === "string" && data.createdBy.trim() !== ""
      ? data.createdBy
      : undefined;
  return {
    id,
    message: String(data.message ?? data.body ?? ""),
    locationName: String(data.locationName ?? ""),
    gps: {
      lat: Number(data.gps?.lat ?? 0),
      lon: Number(data.gps?.lon ?? 0),
    },
    agency: parseAgency(data.agency),
    title,
    createdAt: timestampToIso(data.createdAt),
    createdBy,
    translations: normalizeTranslations(data.translations),
  };
}

/** When a `lang` filter is supplied, surface the pre-translated body via `message`. */
function projectForLang(a: Announcement, lang?: string): Announcement {
  if (!lang) return a;
  const translated = a.translations[lang];
  if (!translated) return a;
  return { ...a, message: translated };
}

export const announcementService = {
  async create(
    payload: CreateAnnouncementBody,
    userId?: string,
  ): Promise<Announcement> {
    const db = getFirestoreDb();
    const id = crypto.randomUUID();
    const ref = db.collection(COLLECTION).doc(id);

    // P2-6: fan-translate the body before persisting so GETs are O(1).
    const translations = await translateForAll(payload.message);

    await ref.set({
      message: payload.message,
      body: payload.message,
      title: payload.title ?? null,
      agency: payload.agency ?? null,
      locationName: payload.locationName,
      gps: payload.gps,
      translations,
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

  async listNearby(params: {
    lat: number;
    lon: number;
    limit?: number;
    lang?: string;
  }): Promise<Announcement[]> {
    const db = getFirestoreDb();
    const limit = Math.max(1, Math.min(200, params.limit ?? 100));
    const snap = await db
      .collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const items = snap.docs.map((doc) => docToAnnouncement(doc.id, doc.data()));

    return items
      .filter(
        (item) =>
          haversineMeters(
            { lat: params.lat, lon: params.lon },
            { lat: item.gps.lat, lon: item.gps.lon },
          ) <= ANNOUNCEMENT_RADIUS_M,
      )
      .map((item) => projectForLang(item, params.lang));
  },

  /** P2-6: latest announcements (no geo filter) optionally rendered in `lang`. */
  async listLatest(
    params: { lang?: string; limit?: number } = {},
  ): Promise<Announcement[]> {
    const db = getFirestoreDb();
    const limit = Math.max(1, Math.min(200, params.limit ?? 50));
    const snap = await db
      .collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs
      .map((doc) => docToAnnouncement(doc.id, doc.data()))
      .map((item) => projectForLang(item, params.lang));
  },
};
