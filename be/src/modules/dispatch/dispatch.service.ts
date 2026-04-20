import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import { config } from "../../lib/config";
import { haversineMeters } from "../../lib/geo";
import type { AgencyScope, DeviceData, HeatmapPoint } from "../data/data.schema";
import { dataService } from "../data/data.service";
import { categoriesFromTriageMeta } from "../triage/triage.schema";
import type {
  DispatchDecision,
  DispatchRecommendation,
  DispatchRecommendationResponse,
  IncidentBrief,
  RescuerProfile,
} from "./dispatch.schema";

const INCIDENT_MIN_SEVERITY = 1;
const INCIDENT_MAX_AGE_MINUTES = 10080;
const MAX_LOAD = 4;
const SHORTLIST_SIZE = 3;

type CandidateIncident = {
  id: string;
  severity: number;
  categories: string[];
  agencyHints: AgencyScope[];
  summary: string;
  location: { lat: number; lon: number };
  receivedAt: string;
};

type BuildIncidentResult =
  | { incident: CandidateIncident }
  | { incident: null; reason: "no_gps" | "low_severity" | "stale" };

type DecisionWithSource = DispatchDecision & { modelAssisted: boolean };

const DUMMY_RESCUERS: RescuerProfile[] = [
  {
    id: "medic-201",
    name: "Dr. Maya Patel",
    agency: "medical",
    sourceSystem: "Medical CAD",
    location: { lat: -33.8734, lon: 151.2069 },
    radiusM: 6000,
    status: "available",
  },
  {
    id: "medic-317",
    name: "Nurse Liam Grant",
    agency: "medical",
    sourceSystem: "Medical CAD",
    location: { lat: -37.8136, lon: 144.9631 },
    radiusM: 5000,
    status: "available",
  },
  {
    id: "fire-042",
    name: "Captain Elena Rossi",
    agency: "fire",
    sourceSystem: "Fire Dispatch",
    location: { lat: -27.4698, lon: 153.0251 },
    radiusM: 9000,
    status: "available",
  },
  {
    id: "fire-126",
    name: "Lt. Noah Campbell",
    agency: "fire",
    sourceSystem: "Fire Dispatch",
    location: { lat: -34.9285, lon: 138.6007 },
    radiusM: 8000,
    status: "enroute",
  },
  {
    id: "police-908",
    name: "Sgt. Olivia Hart",
    agency: "police",
    sourceSystem: "Police RMS",
    location: { lat: -31.9505, lon: 115.8605 },
    radiusM: 6500,
    status: "available",
  },
  {
    id: "police-611",
    name: "Officer Ethan Blake",
    agency: "police",
    sourceSystem: "Police RMS",
    location: { lat: -35.2809, lon: 149.13 },
    radiusM: 7000,
    status: "busy",
  },
];

const decisionSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    selectedResponderId: { type: SchemaType.STRING },
    confidenceLevel: { type: SchemaType.INTEGER },
    rationale: { type: SchemaType.STRING },
    escalate: { type: SchemaType.BOOLEAN },
  },
  required: ["selectedResponderId", "confidenceLevel", "rationale", "escalate"],
};

function severityFromMeta(meta?: Record<string, unknown>): number {
  const tri = meta?.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    const raw = (tri as { severity?: unknown }).severity;
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.min(5, Math.max(1, Math.round(raw)));
  }
  return 1;
}

function summaryFromMeta(d: DeviceData): string {
  const tri = d.meta?.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    const raw = (tri as { summary?: unknown }).summary;
    if (typeof raw === "string" && raw.trim() !== "") return raw.trim().slice(0, 200);
  }
  const msg = d.message.trim();
  return (msg || "Incident with limited details").slice(0, 200);
}

function ageMinutes(receivedAt: string): number {
  const ms = Date.now() - new Date(receivedAt).getTime();
  if (!Number.isFinite(ms)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.round(ms / 60000));
}

function inferAgencies(categories: string[], fallback?: AgencyScope): AgencyScope[] {
  const out = new Set<AgencyScope>();
  for (const category of categories) {
    if (category === "medical" || category === "fire" || category === "police") out.add(category);
    if (category === "rescue") out.add("fire");
  }
  if (out.size === 0 && fallback) out.add(fallback);
  if (out.size === 0) out.add("medical");
  return [...out];
}

function hotspotKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function buildHotspotCounts(rows: DeviceData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.gps) continue;
    const key = hotspotKey(row.gps.lat, row.gps.lon);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function historicalRiskTier(
  incident: CandidateIncident,
  hotspotCounts: Map<string, number>,
): 1 | 2 | 3 {
  const current = hotspotCounts.get(hotspotKey(incident.location.lat, incident.location.lon)) ?? 0;
  const all = [...hotspotCounts.values()].sort((a, b) => a - b);
  if (all.length === 0) return 1;
  const p50 = all[Math.floor(all.length * 0.5)] ?? 0;
  const p80 = all[Math.floor(all.length * 0.8)] ?? 0;
  if (current >= p80 && current > 0) return 3;
  if (current >= p50 && current > 0) return 2;
  return 1;
}

function nearbyActiveCount(incident: CandidateIncident, incidents: CandidateIncident[]): number {
  let count = 0;
  for (const other of incidents) {
    if (other.id === incident.id) continue;
    const m = haversineMeters(incident.location, other.location);
    if (m <= 1500) count += 1;
  }
  return count;
}

function heatIntensity(incident: CandidateIncident, points: HeatmapPoint[]): "low" | "medium" | "high" {
  const local = points.filter((p) => haversineMeters(incident.location, { lat: p.lat, lon: p.lon }) <= 2000);
  if (local.length === 0) return "low";
  const avg = local.reduce((sum, p) => sum + p.weight, 0) / local.length;
  if (avg >= 4) return "high";
  if (avg >= 2) return "medium";
  return "low";
}

function baseLoad(responder: RescuerProfile): number {
  if (responder.status === "busy") return 3;
  if (responder.status === "enroute") return 2;
  return 0;
}

function agencyMatches(incident: CandidateIncident, responder: RescuerProfile): boolean {
  return incident.agencyHints.includes(responder.agency);
}

function scoreResponder(
  incident: CandidateIncident,
  responder: RescuerProfile,
  hotspotTier: 1 | 2 | 3,
): number {
  const distanceKm = haversineMeters(incident.location, responder.location) / 1000;
  const maxRadiusKm = Math.max(1, responder.radiusM / 1000);
  const distanceScore = Math.max(0, 1 - distanceKm / maxRadiusKm);
  const severityMatch = agencyMatches(incident, responder) ? 1 : 0;
  const loadPenalty = Math.max(0, 1 - baseLoad(responder) / MAX_LOAD);
  const zoneRisk = hotspotTier / 3;
  return distanceScore * 0.35 + severityMatch * 0.3 + loadPenalty * 0.2 + zoneRisk * 0.15;
}

function buildCandidateIncident(row: DeviceData): BuildIncidentResult {
  if (!row.gps) return { incident: null, reason: "no_gps" };
  const severity = severityFromMeta(row.meta);
  const age = ageMinutes(row.receivedAt);
  if (severity < INCIDENT_MIN_SEVERITY) return { incident: null, reason: "low_severity" };
  if (age > INCIDENT_MAX_AGE_MINUTES) return { incident: null, reason: "stale" };
  const categories = categoriesFromTriageMeta(row.meta?.triage);
  return {
    incident: {
      id: row.id,
      severity,
      categories,
      agencyHints: inferAgencies(categories, row.agency),
      summary: summaryFromMeta(row),
      location: { lat: row.gps.lat, lon: row.gps.lon },
      receivedAt: row.receivedAt,
    },
  };
}

function parseDecision(raw: string): DispatchDecision {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const selectedResponderId = String(parsed.selectedResponderId ?? "").trim();
  const confidenceRaw =
    typeof parsed.confidenceLevel === "number" && Number.isFinite(parsed.confidenceLevel)
      ? Math.round(parsed.confidenceLevel)
      : 1;
  const confidenceLevel = Math.min(3, Math.max(1, confidenceRaw)) as 1 | 2 | 3;
  const rationale = String(parsed.rationale ?? "").trim();
  const escalate = Boolean(parsed.escalate);
  if (!selectedResponderId) throw new Error("Missing selectedResponderId");
  if (!rationale) throw new Error("Missing rationale");
  return { selectedResponderId, confidenceLevel, rationale, escalate };
}

function buildPrompt(brief: IncidentBrief): string {
  const candidates = brief.candidateResponders
    .map(
      (c) =>
        `- ID: ${c.id} | Agency: ${c.agency} | ETA: ${c.etaMinutes}min | Load: ${c.currentLoad}`,
    )
    .join("\n");
  return [
    "You are a dispatch coordinator. Select the best responder from the shortlist.",
    "",
    "INCIDENT:",
    `- Severity: ${brief.severity}/5`,
    `- Type: ${brief.categories.join(", ")}`,
    `- Summary: ${brief.summary}`,
    `- Zone risk tier: ${brief.historicalRiskTier}/3`,
    `- Active nearby incidents: ${brief.nearbyActiveCount}`,
    `- Heat intensity: ${brief.heatIntensity}`,
    "",
    "CANDIDATES:",
    candidates,
    "",
    "Return JSON only. Choose one responder. Explain in <= 20 words.",
  ].join("\n");
}

function fallbackDecision(brief: IncidentBrief): DecisionWithSource {
  return {
    selectedResponderId: brief.candidateResponders[0].id,
    confidenceLevel: 1,
    rationale: "Fallback: closest available responder",
    escalate: true,
    modelAssisted: false,
  };
}

function applyGuardrails(
  decision: DispatchDecision,
  brief: IncidentBrief,
): DispatchDecision {
  const valid = new Map(brief.candidateResponders.map((c) => [c.id, c]));
  const top = brief.candidateResponders[0];
  const safe: DispatchDecision = { ...decision };

  if (!valid.has(safe.selectedResponderId)) {
    safe.selectedResponderId = top.id;
    safe.escalate = true;
  }
  const selected = valid.get(safe.selectedResponderId)!;
  if (!brief.categories.includes(selected.agency) && !brief.categories.includes("rescue")) {
    const agencyMatch = brief.candidateResponders.find((c) => brief.categories.includes(c.agency));
    if (agencyMatch) safe.selectedResponderId = agencyMatch.id;
  }
  if (selected.currentLoad >= MAX_LOAD) safe.escalate = true;
  safe.confidenceLevel = Math.min(3, Math.max(1, Math.round(safe.confidenceLevel))) as 1 | 2 | 3;
  safe.rationale = safe.rationale.split(/\s+/).slice(0, 25).join(" ");
  return safe;
}

async function decideWithGemini(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  brief: IncidentBrief,
): Promise<DecisionWithSource> {
  const prompt = buildPrompt(brief);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const raw = result.response.text();
      if (!raw || raw.trim() === "") throw new Error("Empty model output");
      const parsed = parseDecision(raw);
      const guarded = applyGuardrails(parsed, brief);
      return { ...guarded, modelAssisted: true };
    } catch {
      // Try one more time, then fallback.
    }
  }

  return fallbackDecision(brief);
}

function toRecommendation(
  incident: CandidateIncident,
  brief: IncidentBrief,
  decision: DecisionWithSource,
): DispatchRecommendation {
  const selected = brief.candidateResponders.find((c) => c.id === decision.selectedResponderId);
  const fallback = brief.candidateResponders[0];
  const picked = selected ?? fallback;
  return {
    incidentId: incident.id,
    severity: incident.severity,
    selectedResponderId: picked.id,
    selectedResponderName: picked.name,
    agency: picked.agency,
    etaMinutes: picked.etaMinutes,
    confidenceLevel: decision.confidenceLevel,
    rationale: decision.rationale,
    escalate: decision.escalate,
    modelAssisted: decision.modelAssisted,
    summary: incident.summary,
  };
}

export const dispatchService = {
  async recommend(params: {
    agencies?: AgencyScope[];
    maxIncidents?: number;
  }): Promise<DispatchRecommendationResponse> {
    const maxIncidents = Math.max(1, Math.min(25, params.maxIncidents ?? 10));

    const rows = await dataService.list({
      limit: 500,
      agencies: params.agencies && params.agencies.length > 0 ? params.agencies : undefined,
    });
    const incidents: CandidateIncident[] = [];
    const dropped = { noGps: 0, lowSeverity: 0, stale: 0 };
    let withGps = 0;
    for (const row of rows) {
      if (row.gps) withGps += 1;
      const built = buildCandidateIncident(row);
      if (built.incident) {
        incidents.push(built.incident);
      } else {
        if (built.reason === "no_gps") dropped.noGps += 1;
        if (built.reason === "low_severity") dropped.lowSeverity += 1;
        if (built.reason === "stale") dropped.stale += 1;
      }
    }
    incidents.sort((a, b) => b.severity - a.severity || ageMinutes(a.receivedAt) - ageMinutes(b.receivedAt));
    const trimmedIncidents = incidents.slice(0, maxIncidents);

    const eligibilitySummary = {
      totalRows: rows.length,
      withGps,
      eligibleBeforeLimit: incidents.length,
      eligibleAfterLimit: trimmedIncidents.length,
      droppedNoGps: dropped.noGps,
      droppedLowSeverity: dropped.lowSeverity,
      droppedStale: dropped.stale,
      thresholds: {
        minSeverity: INCIDENT_MIN_SEVERITY,
        maxAgeMinutes: INCIDENT_MAX_AGE_MINUTES,
      },
    };
    console.log("[dispatch] eligibility summary", eligibilitySummary);
    if (trimmedIncidents.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        recommendations: [],
        meta: {
          totalIncidents: 0,
          modelAssistedCount: 0,
          fallbackCount: 0,
        },
      };
    }

    const allowed = new Set(params.agencies ?? ["medical", "fire", "police"]);
    const responders = DUMMY_RESCUERS.filter((r) => allowed.has(r.agency));
    const hotspotCounts = buildHotspotCounts(rows);
    const heatmap = await dataService.heatmapPoints({
      limit: 400,
      agencies: params.agencies && params.agencies.length > 0 ? params.agencies : undefined,
    });

    const briefs: Array<{ incident: CandidateIncident; brief: IncidentBrief }> = trimmedIncidents
      .map((incident) => {
        const riskTier = historicalRiskTier(incident, hotspotCounts);
        const shortlist = [...responders]
          .map((responder) => {
            const score = scoreResponder(incident, responder, riskTier);
            const etaMinutes = Math.max(
              1,
              Math.round(haversineMeters(incident.location, responder.location) / 450),
            );
            return {
              id: responder.id,
              name: responder.name,
              agency: responder.agency,
              etaMinutes,
              currentLoad: baseLoad(responder),
              score,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, SHORTLIST_SIZE)
          .map(({ score: _score, ...brief }) => brief);

        if (shortlist.length === 0) return null;
        return {
          incident,
          brief: {
            incidentId: incident.id,
            severity: incident.severity,
            categories: incident.categories,
            summary: incident.summary,
            heatIntensity: heatIntensity(incident, heatmap),
            nearbyActiveCount: nearbyActiveCount(incident, trimmedIncidents),
            historicalRiskTier: riskTier,
            candidateResponders: shortlist,
          },
        };
      })
      .filter((x): x is { incident: CandidateIncident; brief: IncidentBrief } => x !== null);

    let model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;
    if (config.geminiApiKey) {
      const genAI = new GoogleGenerativeAI(config.geminiApiKey);
      model = genAI.getGenerativeModel({
        model: config.geminiModel,
        systemInstruction:
          "You are a dispatch coordinator. Output valid JSON only. Never invent responder IDs.",
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: decisionSchema,
        },
      });
    }

    const decisions = await Promise.allSettled(
      briefs.map(async ({ brief }) => {
        if (!model) return fallbackDecision(brief);
        return decideWithGemini(model, brief);
      }),
    );

    const recommendations: DispatchRecommendation[] = [];
    let modelAssistedCount = 0;
    let fallbackCount = 0;

    for (let i = 0; i < briefs.length; i += 1) {
      const pair = briefs[i];
      const decisionResult = decisions[i];
      const decision =
        decisionResult.status === "fulfilled"
          ? decisionResult.value
          : fallbackDecision(pair.brief);
      if (decision.modelAssisted) modelAssistedCount += 1;
      else fallbackCount += 1;
      recommendations.push(toRecommendation(pair.incident, pair.brief, decision));
    }

    return {
      generatedAt: new Date().toISOString(),
      recommendations,
      meta: {
        totalIncidents: incidents.length,
        modelAssistedCount,
        fallbackCount,
      },
    };
  },
};
