import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import { config } from "../../lib/config";
import { haversineMeters } from "../../lib/geo";
import { dataService } from "../data/data.service";
import type { DeviceData } from "../data/data.schema";
import { TRIAGE_SYSTEM_INSTRUCTION } from "./system-instruction";
import {
  TRIAGE_CATEGORIES,
  categoriesFromTriageMeta,
  type TriageCategory,
  type TriageSnapshot,
} from "./triage.schema";

/** Prior MAC thread messages to include in the user prompt (plus the current event in its own section). */
const PRIOR_MESSAGES_FOR_TRIAGE = 5;
/** Fetch enough rows to recover current + up to N priors. */
const MAC_THREAD_FETCH_LIMIT = PRIOR_MESSAGES_FOR_TRIAGE + 15;

const triageJsonSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    categories: {
      type: SchemaType.ARRAY,
      description:
        "One or more incident types (e.g. fire and medical). Order does not matter; no duplicates.",
      items: {
        type: SchemaType.STRING,
        format: "enum",
        enum: [...TRIAGE_CATEGORIES],
      },
    },
    severity: {
      type: SchemaType.INTEGER,
      description: "Integer 1–5",
    },
    summary: { type: SchemaType.STRING },
    victimInstructions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    dispatchMessage: { type: SchemaType.STRING },
    reasoning: { type: SchemaType.STRING },
  },
  required: ["categories", "severity", "summary", "victimInstructions", "dispatchMessage", "reasoning"],
};

function normalizeCategory(raw: string): TriageCategory {
  const c = raw.trim().toLowerCase();
  return (TRIAGE_CATEGORIES as readonly string[]).includes(c) ? (c as TriageCategory) : "unknown";
}

function normalizeCategoriesList(raw: unknown): TriageCategory[] {
  const parts: string[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) parts.push(String(x));
  } else if (typeof raw === "string" && raw.trim() !== "") {
    for (const seg of raw.split(",")) parts.push(seg);
  }
  if (parts.length === 0) return ["unknown"];
  const mapped = parts.map((p) => normalizeCategory(p.trim()));
  const deduped = [...new Set(mapped)];
  return deduped.length ? deduped : ["unknown"];
}

function clampSeverity(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function parseTriageJson(text: string): TriageSnapshot {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const fromCategories = parsed.categories ?? parsed.category;
  const categories = normalizeCategoriesList(fromCategories);
  const severity = clampSeverity(parsed.severity);
  const summary = String(parsed.summary ?? "").trim() || "(no summary)";
  const victimInstructions = Array.isArray(parsed.victimInstructions)
    ? parsed.victimInstructions.map((x) => String(x)).filter((s) => s.trim() !== "")
    : [];
  const dispatchMessage = String(parsed.dispatchMessage ?? "").trim() || summary;
  const reasoning = String(parsed.reasoning ?? "").trim() || "(no reasoning)";
  return {
    categories,
    severity,
    summary,
    victimInstructions,
    dispatchMessage,
    reasoning,
  };
}

function metaHopCount(meta?: Record<string, unknown>): number | undefined {
  const h = meta?.hopCount;
  if (typeof h === "number" && Number.isFinite(h)) return h;
  if (typeof h === "string" && h.trim() !== "" && Number.isFinite(Number(h))) return Number(h);
  return undefined;
}

function triageSummaryForNearby(d: DeviceData): string {
  const t = d.meta?.triage;
  if (t && typeof t === "object" && !Array.isArray(t)) {
    const summary = (t as { summary?: unknown }).summary;
    if (typeof summary === "string" && summary.trim() !== "") return summary.trim();
  }
  const msg = d.message.trim();
  return msg.length > 160 ? `${msg.slice(0, 157)}...` : msg;
}

function selectNearby(
  center: { lat: number; lon: number },
  candidates: DeviceData[],
  excludeId: string,
  radiusM: number,
  max: number,
): DeviceData[] {
  const out: { d: DeviceData; m: number }[] = [];
  for (const d of candidates) {
    if (d.id === excludeId || !d.gps) continue;
    const m = haversineMeters(center, d.gps);
    if (m <= radiusM) out.push({ d, m });
  }
  out.sort((a, b) => a.m - b.m);
  return out.slice(0, max).map((x) => x.d);
}

function buildUserPayload(current: DeviceData, history: DeviceData[], nearby: DeviceData[]): string {
  const hop = metaHopCount(current.meta);
  const lines: string[] = [
    "## Current event",
    JSON.stringify(
      {
        id: current.id,
        macAddress: current.macAddress,
        deviceTime: current.time,
        message: current.message,
        gps: current.gps ?? null,
        hopCount: hop ?? null,
        meta: current.meta ?? {},
      },
      null,
      2,
    ),
  ];

  lines.push(
    `## Prior messages from this device (oldest first, up to ${PRIOR_MESSAGES_FOR_TRIAGE} before the current event)`,
  );
  if (history.length === 0) {
    lines.push("(none — this may be the first message.)");
  } else {
    lines.push(
      JSON.stringify(
        history.map((h) => ({
          time: h.time,
          message: h.message,
          gps: h.gps ?? null,
        })),
        null,
        2,
      ),
    );
  }

  lines.push(`## Other incidents within ~${config.triageNearbyRadiusM}m (not including this event)`);
  if (nearby.length === 0) {
    lines.push("(none in range or no GPS for comparison.)");
  } else {
    lines.push(
      JSON.stringify(
        nearby.map((n) => ({
          id: n.id,
          approxDistanceMeters:
            current.gps && n.gps ? Math.round(haversineMeters(current.gps, n.gps)) : null,
          macAddress: n.macAddress,
          time: n.time,
          summary: triageSummaryForNearby(n),
          categories: categoriesFromTriageMeta(n.meta?.triage),
          severity:
            n.meta?.triage &&
            typeof n.meta.triage === "object" &&
            n.meta.triage !== null &&
            "severity" in n.meta.triage
              ? (n.meta.triage as { severity?: unknown }).severity
              : undefined,
        })),
        null,
        2,
      ),
    );
  }

  lines.push("Triage this event and respond with JSON only (schema already enforced).");
  return lines.join("\n\n");
}

/**
 * Runs Gemini triage for a freshly ingested row, merges `meta.triage`, returns updated record.
 * No-op if triage is disabled or API key missing. Throws on unrecoverable errors.
 */
export async function triageAfterIngest(eventId: string): Promise<DeviceData | null> {
  if (!config.triageEnabled || !config.geminiApiKey) {
    return null;
  }

  const record = await dataService.getById(eventId);
  if (!record) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    systemInstruction: TRIAGE_SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: triageJsonSchema,
    },
  });

  const thread = await dataService.list({ macAddress: record.macAddress, limit: MAC_THREAD_FETCH_LIMIT });
  const chronological = [...thread].reverse();
  const priorOnly = chronological.filter((h) => h.id !== record.id);
  const historyForPrompt = priorOnly.slice(-PRIOR_MESSAGES_FOR_TRIAGE);

  let nearby: DeviceData[] = [];
  if (record.gps) {
    const recent = await dataService.listRecentWithGps(400);
    nearby = selectNearby(
      record.gps,
      recent,
      record.id,
      config.triageNearbyRadiusM,
      25,
    );
  }

  const userText = buildUserPayload(record, historyForPrompt, nearby);

  console.log("[triage] systemInstruction (full)\n" + TRIAGE_SYSTEM_INSTRUCTION);
  console.log("[triage] user message (full)\n" + userText);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
  });

  const raw = result.response.text();
  console.log("[triage] model raw output (full)\n" + (raw ?? ""));

  if (!raw || raw.trim() === "") {
    throw new Error("Gemini returned empty triage response");
  }

  let triage: TriageSnapshot;
  try {
    triage = parseTriageJson(raw);
  } catch {
    throw new Error(`Gemini triage JSON parse failed: ${raw.slice(0, 200)}`);
  }

  return dataService.mergeDeviceMeta(eventId, {
    triage,
    triagedAt: new Date().toISOString(),
    triageModel: config.geminiModel,
  });
}

/** Persists `meta.triageError` on failure so ingest still succeeds. */
export async function triageAfterIngestSafe(eventId: string): Promise<DeviceData | null> {
  try {
    return await triageAfterIngest(eventId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await dataService.mergeDeviceMeta(eventId, {
      triageError: { message, at: new Date().toISOString() },
    });
    return dataService.getById(eventId);
  }
}
