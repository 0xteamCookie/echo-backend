export type IssueTokenBody = {
  /** Stable id for this rescuer (badge id, user id, etc.) */
  sub: string;
  /** Role slug used by clients. */
  role: "super_admin" | "medical" | "fire" | "police";
  /** Primary agency scope for this token. */
  agency: "medical" | "fire" | "police";
  /** Display name of the agent. */
  name: string;
  /** Authorized radius in metres. */
  radius_m: number;
  /** Latitude (WGS84), -90..90 */
  lat: number;
  /** Longitude (WGS84), -180..180 */
  lng: number;
  /** Lifetime in seconds (capped server-side). */
  expiresInSeconds?: number;
};
