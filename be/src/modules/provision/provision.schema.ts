export type IssueTokenBody = {
  /** Stable id for this rescuer (badge id, user id, etc.) */
  sub: string;
  /** Role slug: e.g. fire, medic, admin */
  role: string;
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
