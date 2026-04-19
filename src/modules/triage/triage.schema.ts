export const TRIAGE_CATEGORIES = [
  "medical",
  "fire",
  "police",
  "rescue",
  "broadcast",
  "unknown",
] as const;

export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];

/** Stored under `meta.triage` after Gemini runs. */
export type TriageSnapshot = {
  category: TriageCategory;
  /** 1 (low) – 5 (critical) */
  severity: number;
  summary: string;
  victimInstructions: string[];
  dispatchMessage: string;
  reasoning: string;
};
