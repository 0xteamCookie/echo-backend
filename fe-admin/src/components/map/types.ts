import type { DeviceEntry } from "../../hooks/useRealtimeEvents";

export type HeatPoint = {
  lat: number;
  lng: number;
  weight: number;
  status?: string;
};

export type ClickableEntry = {
  entry: DeviceEntry;
  lat: number;
  lng: number;
};

const CATEGORY_WEIGHT: Record<string, number> = {
  medical: 1.0,
  fire: 1.5,
  police: 1.0,
  rescue: 1.2,
  broadcast: 0.8,
  unknown: 0.5,
};

export function isResolvedStatus(status: string | undefined): boolean {
  return typeof status === "string" && status.trim().toLowerCase() === "resolved";
}

export function readSeverity(entry: DeviceEntry): number {
  const meta = entry.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return 1;
  const sevRaw = (meta as Record<string, unknown>).severity;
  if (typeof sevRaw === "number" && Number.isFinite(sevRaw)) {
    return Math.min(5, Math.max(1, Math.round(sevRaw)));
  }
  const triage = (meta as Record<string, unknown>).triage;
  if (triage && typeof triage === "object" && !Array.isArray(triage)) {
    const triageSev = (triage as Record<string, unknown>).severity;
    if (typeof triageSev === "number" && Number.isFinite(triageSev)) {
      return Math.min(5, Math.max(1, Math.round(triageSev)));
    }
  }
  return 1;
}

export function isSosEntry(entry: DeviceEntry): boolean {
  const meta = entry.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  const raw = (meta as Record<string, unknown>).isSos;
  return raw === true || raw === 1 || raw === "1" || raw === "true";
}

export function entryToHeatPoint(entry: DeviceEntry): HeatPoint | null {
  if (!entry.gps) return null;
  const severity = readSeverity(entry);
  const cat = entry.agency ?? "unknown";
  let weight = severity * (CATEGORY_WEIGHT[cat] ?? CATEGORY_WEIGHT.unknown);
  if (isResolvedStatus(entry.status)) weight *= 0.12;
  return {
    lat: entry.gps.lat,
    lng: entry.gps.lon,
    weight,
    status: entry.status,
  };
}

export function entryToClickable(entry: DeviceEntry): ClickableEntry | null {
  if (!entry.gps) return null;
  return { entry, lat: entry.gps.lat, lng: entry.gps.lon };
}

export function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "--";
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
