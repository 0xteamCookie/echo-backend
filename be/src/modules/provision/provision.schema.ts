export type IssueTokenBody = {
  /** Stable id for this rescuer (badge id, user id, etc.) */
  sub: string;
  /** Role slug: e.g. fire, medic, admin */
  role: string;
  org?: string;
  name?: string;
  /** Lifetime in seconds (capped server-side). */
  expiresInSeconds?: number;
};
