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
  /** One or more dispatch types (e.g. fire + medical). Legacy rows may still have `category` (string) only. */
  categories: TriageCategory[];
  /** 1 (low) – 5 (critical) */
  severity: number;
  summary: string;
  victimInstructions: string[];
  dispatchMessage: string;
  reasoning: string;
};

function normalizeLabel(s: string): TriageCategory {
  const c = s.trim().toLowerCase();
  return (TRIAGE_CATEGORIES as readonly string[]).includes(c)
    ? (c as TriageCategory)
    : "unknown";
}

/** Read categories from stored `meta.triage` (new `categories[]` or legacy `category` string / comma-separated). */
export function categoriesFromTriageMeta(triage: unknown): TriageCategory[] {
  if (!triage || typeof triage !== "object" || Array.isArray(triage))
    return ["unknown"];
  const t = triage as Record<string, unknown>;
  let raw: string[] = [];
  if (Array.isArray(t.categories) && t.categories.length > 0) {
    raw = t.categories.map((x) => String(x)).filter((s) => s.trim() !== "");
  } else if (typeof t.category === "string" && t.category.trim() !== "") {
    raw = t.category
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
  }
  if (raw.length === 0) return ["unknown"];
  const mapped = raw.map((s) => normalizeLabel(s));
  const deduped = [...new Set(mapped)];
  return deduped.length ? deduped : ["unknown"];
}
