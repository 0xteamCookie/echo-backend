export type GpsCoordinates = {
  lat: number;
  lon: number;
};

export type AgencyScope = "medical" | "fire" | "police";

export type DeviceData = {
  id: string;
  macAddress: string;
  message: string;
  agency?: AgencyScope;
  time: string; // ISO8601 recommended
  gps?: GpsCoordinates;
  meta?: Record<string, unknown>;
  receivedAt: string;
  status?: string;
  assignment?: {
    rescuerId?: string;
    rescuerName?: string;
    assignedAt?: string;
    assignedBy?: string;
  };
};

export type CreateDeviceDataBody = {
  macAddress: string;
  message: string;
  agency?: AgencyScope;
  time: string;
  gps?: GpsCoordinates;
  /** Mesh / device metadata: e.g. hopCount, battery, messageId (for dedup), triage from AI agent */
  meta?: Record<string, unknown>;
};

/** One point for Leaflet / Mapbox heatmap layers (poll via GET /api/data/heatmap). */
export type HeatmapPoint = {
  id: string;
  lat: number;
  lon: number;
  locationName?: string;
  /** severity (1–5) × max category weight across labels; use for heatmap intensity */
  weight: number;
  /** All triage labels (e.g. fire + medical). */
  categories: string[];
  /** Comma-separated copy of `categories` for simple clients. */
  category: string;
  severity: number;
  receivedAt: string;
  macAddress: string;
  agency?: AgencyScope;
  /** Same as `DeviceData.status` when set (e.g. resolved). */
  status?: string;
};

