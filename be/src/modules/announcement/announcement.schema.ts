export type Announcement = {
  id: string;
  message: string;
  locationName: string;
  gps: {
    lat: number;
    lon: number;
  };
  /** P2-6: Optional agency scope for the announcement. */
  agency?: "medical" | "fire" | "police";
  /** P2-6: Optional short title; falls back to truncated `message` when absent. */
  title?: string;
  createdAt: string;
  createdBy?: string;
  /** P2-6: Pre-translated bodies keyed by ISO 639-1 code. Empty when translation disabled. */
  translations: Record<string, string>;
};

export type CreateAnnouncementBody = {
  message: string;
  locationName: string;
  gps: {
    lat: number;
    lon: number;
  };
  title?: string;
  agency?: "medical" | "fire" | "police";
};
