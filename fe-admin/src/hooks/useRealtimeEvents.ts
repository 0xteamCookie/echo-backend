"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit as limitQuery,
  onSnapshot,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirestoreClient } from "../lib/firebase-client";
import { useAuth } from "../lib/auth/provider";

// ── Domain types (mirrors DeviceData in the backend schema) ─────────────────

export type AgencyScope = "medical" | "fire" | "police";

export type DeviceEntry = {
  id: string;
  macAddress: string;
  message: string;
  agency?: AgencyScope;
  time: string;
  gps?: { lat: number; lon: number };
  meta?: Record<string, unknown>;
  receivedAt: string;
  /** Operational status written by the admin drawer via POST /api/data/:id/status. */
  status?: string;
  assignment?: {
    rescuerId?: string;
    rescuerName?: string;
    assignedAt?: string;
  };
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Sentinel returned in `error` when the Firebase client SDK cannot be
 * initialized (missing NEXT_PUBLIC_FIREBASE_* env vars). Callers should
 * fall back to their existing REST polling path.
 */
export const FIRESTORE_NO_CLIENT = "FIRESTORE_NO_CLIENT" as const;

export type UseRealtimeEventsOptions = {
  /** Filter by agency. Omit to receive events for all agencies. */
  agency?: AgencyScope;
  /** ISO 8601 timestamp — return only events with receivedAt after this value. */
  since?: string;
  /** Maximum number of documents to return. Capped at 500. Default: 200. */
  limit?: number;
  /** Set to false to skip subscribing (e.g. while the user is unauthenticated). */
  enabled?: boolean;
};

export type UseRealtimeEventsResult = {
  events: DeviceEntry[];
  loading: boolean;
  /** Null when no error. Equal to `FIRESTORE_NO_CLIENT` when the client SDK
   *  is not configured; any other string is a Firestore listener error. */
  error: string | null;
};

// ── Internal helpers ─────────────────────────────────────────────────────────

const COLLECTION = "device_entries";

function parseAgency(v: unknown): AgencyScope | undefined {
  if (v === "medical" || v === "fire" || v === "police") return v;
  return undefined;
}

function docToEntry(id: string, data: Record<string, unknown>): DeviceEntry {
  const rawGps = data.gps as { lat?: unknown; lon?: unknown } | null | undefined;
  const gps =
    rawGps &&
    typeof rawGps.lat === "number" &&
    typeof rawGps.lon === "number"
      ? { lat: rawGps.lat, lon: rawGps.lon }
      : undefined;

  const rawMeta = data.meta;
  const meta =
    rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
      ? (rawMeta as Record<string, unknown>)
      : undefined;

  let receivedAt: string;
  const ra = data.receivedAt;
  if (
    ra &&
    typeof ra === "object" &&
    "toDate" in ra &&
    typeof (ra as Timestamp).toDate === "function"
  ) {
    receivedAt = (ra as Timestamp).toDate().toISOString();
  } else if (typeof ra === "string") {
    receivedAt = ra;
  } else {
    receivedAt = new Date().toISOString();
  }

  return {
    id,
    macAddress: String(data.macAddress ?? ""),
    message: String(data.message ?? ""),
    agency: parseAgency(data.agency),
    time: String(data.time ?? ""),
    gps,
    meta,
    receivedAt,
    status: typeof data.status === "string" ? data.status : undefined,
    assignment:
      data.assignment &&
      typeof data.assignment === "object" &&
      !Array.isArray(data.assignment)
        ? {
            rescuerId:
              typeof (data.assignment as Record<string, unknown>).rescuerId === "string"
                ? ((data.assignment as Record<string, unknown>).rescuerId as string)
                : undefined,
            rescuerName:
              typeof (data.assignment as Record<string, unknown>).rescuerName === "string"
                ? ((data.assignment as Record<string, unknown>).rescuerName as string)
                : undefined,
            assignedAt:
              typeof (data.assignment as Record<string, unknown>).assignedAt === "string"
                ? ((data.assignment as Record<string, unknown>).assignedAt as string)
                : undefined,
          }
        : undefined,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the `device_entries` Firestore collection via `onSnapshot`
 * and returns live events. Requires the user to be authenticated.
 *
 * When `getFirestoreClient()` returns null (env vars missing), `error` is set
 * to `FIRESTORE_NO_CLIENT` so the caller can fall back to REST polling.
 */
export function useRealtimeEvents({
  agency,
  since,
  limit = 200,
  enabled = true,
}: UseRealtimeEventsOptions = {}): UseRealtimeEventsResult {
  const { session, ready } = useAuth();
  const [events, setEvents] = useState<DeviceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !enabled || !session.authenticated) {
      setLoading(false);
      return;
    }

    const db = getFirestoreClient();
    if (!db) {
      setError(FIRESTORE_NO_CLIENT);
      setLoading(false);
      return;
    }

    const col = collection(db, COLLECTION);
    const constraints: QueryConstraint[] = [];

    if (agency) {
      constraints.push(where("agency", "==", agency));
    }

    if (since) {
      const d = new Date(since);
      if (!Number.isNaN(d.getTime())) {
        constraints.push(where("receivedAt", ">", Timestamp.fromDate(d)));
        constraints.push(orderBy("receivedAt", "asc"));
      } else {
        constraints.push(orderBy("receivedAt", "desc"));
      }
    } else {
      constraints.push(orderBy("receivedAt", "desc"));
    }

    constraints.push(limitQuery(Math.min(500, Math.max(1, limit))));

    const q = query(col, ...constraints);

    setLoading(true);

    const unsub = onSnapshot(
      q,
      (snap) => {
        setEvents(
          snap.docs.map((d) =>
            docToEntry(d.id, d.data() as Record<string, unknown>),
          ),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [ready, enabled, session.authenticated, agency, since, limit]);

  return { events, loading, error };
}
