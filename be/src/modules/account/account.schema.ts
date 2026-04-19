export type AccountProfile = {
  id: string;
  email?: string;
  /** Client-reported device info (model, OS, etc.) — stored in Firestore under `users/{id}`. */
  device?: Record<string, unknown>;
  /** Client-reported location (e.g. GPS or coarse region) — stored in Firestore under `users/{id}`. */
  location?: Record<string, unknown>;
};

export type UpdateAccountBody = {
  email?: string;
  device?: Record<string, unknown>;
  location?: Record<string, unknown>;
};
