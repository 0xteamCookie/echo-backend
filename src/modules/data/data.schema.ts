export type GpsCoordinates = {
  lat: number;
  lon: number;
};

export type DeviceData = {
  id: string;
  macAddress: string;
  message: string;
  time: string; // ISO8601 recommended
  gps?: GpsCoordinates;
  meta?: Record<string, unknown>;
  receivedAt: string;
};

export type CreateDeviceDataBody = {
  macAddress: string;
  message: string;
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
  /** severity (1–5) × category weight; use for heatmap intensity */
  weight: number;
  category: string;
  severity: number;
  receivedAt: string;
  macAddress: string;
};

