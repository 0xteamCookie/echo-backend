import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import { config } from "../../lib/config";
import { haversineMeters } from "../../lib/geo";
import type { AgencyScope, DeviceData } from "../data/data.schema";
import { dataService } from "../data/data.service";
import { categoriesFromTriageMeta } from "../triage/triage.schema";
import type {
  DispatchRecommendation,
  DispatchRecommendationResponse,
  RecommendedResponder,
  RescuerProfile,
} from "./dispatch.schema";
import { DISPATCH_SYSTEM_INSTRUCTION } from "./system-instruction";

type CandidateIncident = {
  id: string;
  severity: number;
  categories: string[];
  summary: string;
  dispatchInstruction: string;
  agencyHints: AgencyScope[];
  priorityScore: number;
  gps: { lat: number; lon: number } | null;
  receivedAt: string;
  message: string;
};

type PlannerOutput = {
  recommendations: Array<{
    incidentId: string;
    agency: AgencyScope;
    rescuerId: string;
    priority: number;
    rationale: string;
    dispatchInstruction?: string;
  }>;
  plannerNotes: string[];
};

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

const dispatchJsonSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    recommendations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          incidentId: { type: SchemaType.STRING },
          agency: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["medical", "fire", "police"],
          },
          rescuerId: { type: SchemaType.STRING },
          priority: { type: SchemaType.NUMBER },
          rationale: { type: SchemaType.STRING },
          dispatchInstruction: { type: SchemaType.STRING },
        },
        required: ["incidentId", "agency", "rescuerId", "priority", "rationale"],
      },
    },
    plannerNotes: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ["recommendations", "plannerNotes"],
};

function severityFromMeta(meta?: Record<string, unknown>): number {
  const tri = meta?.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    const raw = (tri as { severity?: unknown }).severity;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.min(5, Math.max(1, Math.round(raw)));
    }
  }
  return 1;
}

function summaryFromMeta(d: DeviceData): string {
  const tri = d.meta?.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    const raw = (tri as { summary?: unknown }).summary;
    if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  }
  const msg = d.message.trim();
  return msg.length > 160 ? `${msg.slice(0, 157)}...` : msg || "Incident with limited details";
}

function dispatchMessageFromMeta(d: DeviceData): string {
  const tri = d.meta?.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    const raw = (tri as { dispatchMessage?: unknown }).dispatchMessage;
    if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  }
  return `Dispatch support for incident ${d.id}`;
}

function inferAgencies(d: DeviceData): AgencyScope[] {
  const categories = categoriesFromTriageMeta(d.meta?.triage);
  const agencies = new Set<AgencyScope>();
  for (const c of categories) {
    if (c === "medical" || c === "fire" || c === "police") agencies.add(c);
    if (c === "rescue") agencies.add("fire");
  }
  if (agencies.size === 0 && d.agency) agencies.add(d.agency);
  if (agencies.size === 0) agencies.add("medical");
  return [...agencies];
}

function recencyBoost(receivedAt: string): number {
  const ms = Date.now() - new Date(receivedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0.4;
  if (ms < 10 * 60_000) return 1.0;
  if (ms < 30 * 60_000) return 0.8;
  if (ms < 60 * 60_000) return 0.6;
  if (ms < 2 * 60 * 60_000) return 0.4;
  return 0.2;
}

function computePriorityScore(d: DeviceData): number {
  const severity = severityFromMeta(d.meta);
  const categories = categoriesFromTriageMeta(d.meta?.triage);
  const categoryWeight = categories.includes("fire") ? 1.25 : categories.includes("medical") ? 1.15 : 1.0;
  return Number((severity * categoryWeight + recencyBoost(d.receivedAt)).toFixed(2));
}

function hotspotKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function topHotspotsFromIncidents(rows: DeviceData[]): Array<{ lat: number; lon: number; count: number }> {
  const buckets = new Map<string, { latSum: number; lonSum: number; count: number }>();
  for (const row of rows) {
    if (!row.gps) continue;
    const key = hotspotKey(row.gps.lat, row.gps.lon);
    const hit = buckets.get(key) ?? { latSum: 0, lonSum: 0, count: 0 };
    hit.latSum += row.gps.lat;
    hit.lonSum += row.gps.lon;
    hit.count += 1;
    buckets.set(key, hit);
  }
  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((b) => ({
      lat: Number((b.latSum / b.count).toFixed(5)),
      lon: Number((b.lonSum / b.count).toFixed(5)),
      count: b.count,
    }));
}

function toCandidateIncident(d: DeviceData): CandidateIncident {
  return {
    id: d.id,
    severity: severityFromMeta(d.meta),
    categories: categoriesFromTriageMeta(d.meta?.triage),
    summary: summaryFromMeta(d),
    dispatchInstruction: dispatchMessageFromMeta(d),
    agencyHints: inferAgencies(d),
    priorityScore: computePriorityScore(d),
    gps: d.gps ? { lat: d.gps.lat, lon: d.gps.lon } : null,
    receivedAt: d.receivedAt,
    message: d.message,
  };
}

function buildPlannerPrompt(params: {
  incidents: CandidateIncident[];
  responders: RescuerProfile[];
  heatmapContext: {
    points: number;
    avgWeight: number;
    byAgency: Record<AgencyScope, number>;
  };
  historicalHotspots: Array<{ lat: number; lon: number; count: number }>;
}): string {
  return [
    "## Dispatch candidates",
    JSON.stringify(params.incidents, null, 2),
    "## Available responders",
    JSON.stringify(params.responders, null, 2),
    "## Live heatmap context",
    JSON.stringify(params.heatmapContext, null, 2),
    "## Historical repeated incident zones",
    JSON.stringify(params.historicalHotspots, null, 2),
    "Return JSON only.",
  ].join("\n\n");
}

function repairJsonLikeText(input: string): string {
  return input
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // common model glitch: `12.` (invalid JSON number) before separator
    .replace(/(-?\d+)\.(\s*[,}\]])/g, "$1.0$2")
    // common model glitch: trailing commas
    .replace(/,\s*([}\]])/g, "$1");
}

function extractLikelyJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }
  return raw;
}

function parsePlannerOutput(raw: string): PlannerOutput {
  const attempts: string[] = [
    raw,
    repairJsonLikeText(raw),
    repairJsonLikeText(extractLikelyJsonObject(raw)),
  ];

  let parsed: Record<string, unknown> | null = null;
  let parseError: unknown;
  for (const candidate of attempts) {
    try {
      parsed = JSON.parse(candidate) as Record<string, unknown>;
      break;
    } catch (err) {
      parseError = err;
    }
  }
  if (!parsed) {
    const message = parseError instanceof Error ? parseError.message : "Invalid JSON";
    throw new Error(`Gemini dispatch JSON parse failed: ${message}`);
  }

  const recommendationsRaw = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  const plannerNotesRaw = Array.isArray(parsed.plannerNotes) ? parsed.plannerNotes : [];

  const recommendations = recommendationsRaw
    .map((x) => x as Record<string, unknown>)
    .map((x) => ({
      incidentId: String(x.incidentId ?? "").trim(),
      agency: String(x.agency ?? "").trim().toLowerCase() as AgencyScope,
      rescuerId: String(x.rescuerId ?? "").trim(),
      priority: typeof x.priority === "number" && Number.isFinite(x.priority) ? x.priority : 0,
      rationale: String(x.rationale ?? "").trim(),
      dispatchInstruction:
        typeof x.dispatchInstruction === "string" && x.dispatchInstruction.trim() !== ""
          ? x.dispatchInstruction.trim()
          : undefined,
    }))
    .filter(
      (x) =>
        x.incidentId !== "" &&
        (x.agency === "medical" || x.agency === "fire" || x.agency === "police") &&
        x.rescuerId !== "" &&
        x.rationale !== "",
    );

  const plannerNotes = plannerNotesRaw
    .map((x) => String(x).trim())
    .filter((x) => x !== "");

  return { recommendations, plannerNotes };
}

function toResponder(
  rescuer: RescuerProfile,
  incident: CandidateIncident,
  rationale: string,
): RecommendedResponder {
  const distanceMeters = incident.gps
    ? Math.round(haversineMeters(incident.gps, rescuer.location))
    : Math.round(rescuer.radiusM * 1.3);
  const etaMinutes = Math.max(2, Math.round(distanceMeters / 450));
  return {
    rescuerId: rescuer.id,
    name: rescuer.name,
    agency: rescuer.agency,
    sourceSystem: rescuer.sourceSystem,
    etaMinutes,
    distanceMeters,
    status: rescuer.status,
    rationale,
  };
}

export const dispatchService = {
  async recommend(params: {
    agencies?: AgencyScope[];
    maxIncidents?: number;
  }): Promise<DispatchRecommendationResponse> {
    if (!config.geminiApiKey) {
      throw new Error("Gemini is required for dispatch recommendations (missing GEMINI_API_KEY)");
    }

    const maxIncidents = Math.max(1, Math.min(25, params.maxIncidents ?? 10));
    const incidentRows = await dataService.list({
      limit: 300,
      agencies: params.agencies && params.agencies.length > 0 ? params.agencies : undefined,
    });
    const candidates = incidentRows
      .filter((d) => d.gps)
      .sort((a, b) => computePriorityScore(b) - computePriorityScore(a))
      .slice(0, maxIncidents)
      .map(toCandidateIncident);

    const allowedAgencySet = new Set(params.agencies ?? ["medical", "fire", "police"]);
    const responders = DUMMY_RESCUERS.filter((r) => allowedAgencySet.has(r.agency));

    const heatmapPoints = await dataService.heatmapPoints({
      limit: 300,
      agencies: params.agencies && params.agencies.length > 0 ? params.agencies : undefined,
    });
    const byAgency: Record<AgencyScope, number> = { medical: 0, fire: 0, police: 0 };
    for (const p of heatmapPoints) {
      const a = p.agency;
      if (a) byAgency[a] += 1;
    }
    const heatmapContext = {
      points: heatmapPoints.length,
      avgWeight:
        heatmapPoints.length > 0
          ? Number(
              (
                heatmapPoints.reduce((sum, p) => sum + (typeof p.weight === "number" ? p.weight : 0), 0) /
                heatmapPoints.length
              ).toFixed(2),
            )
          : 0,
      byAgency,
    };
    const historicalHotspots = topHotspotsFromIncidents(incidentRows);

    if (candidates.length === 0) {
      return {
        overview: {
          totalIncidentsReviewed: incidentRows.length,
          recommendationsCount: 0,
          highSeverityCount: 0,
          agencyDemand: byAgency,
        },
        recommendations: [],
        planner: {
          mode: "heuristic-agentic",
          notes: ["No geolocated incidents available for dispatch planning."],
        },
      };
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel,
      systemInstruction: DISPATCH_SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 21048,
        responseMimeType: "application/json",
        responseSchema: dispatchJsonSchema,
      },
    });

    const plannerPrompt = buildPlannerPrompt({
      incidents: candidates,
      responders,
      heatmapContext,
      historicalHotspots,
    });
    console.log("[dispatch] planner prompt (full)\n" + plannerPrompt);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: plannerPrompt }] }],
    });
    const raw = result.response.text();
    console.log("[dispatch] model raw output (full)\n" + (raw ?? ""));
    if (!raw || raw.trim() === "") {
      throw new Error("Gemini returned empty dispatch planner response");
    }
    let parsed: PlannerOutput;
    try {
      parsed = parsePlannerOutput(raw);
    } catch {
      // One retry with explicit JSON correction instruction if the first output was malformed.
      const repairPrompt =
        `${plannerPrompt}\n\nYour previous answer was malformed JSON. ` +
        `Return ONLY valid JSON matching the same schema. Do not include markdown fences.`;
      const repairResult = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
      });
      const repairRaw = repairResult.response.text();
      console.log("[dispatch] model repair output (full)\n" + (repairRaw ?? ""));
      if (!repairRaw || repairRaw.trim() === "") {
        throw new Error("Gemini returned empty dispatch planner response after repair retry");
      }
      parsed = parsePlannerOutput(repairRaw);
    }

    const incidentMap = new Map(candidates.map((i) => [i.id, i]));
    const responderMap = new Map(responders.map((r) => [r.id, r]));
    const recommendations: DispatchRecommendation[] = [];
    const demand: Record<AgencyScope, number> = { medical: 0, fire: 0, police: 0 };

    for (const plan of parsed.recommendations) {
      const incident = incidentMap.get(plan.incidentId);
      const rescuer = responderMap.get(plan.rescuerId);
      if (!incident || !rescuer) continue;
      if (rescuer.agency !== plan.agency) continue;
      demand[plan.agency] += 1;
      const responder = toResponder(rescuer, incident, plan.rationale);
      recommendations.push({
        incidentId: incident.id,
        message: incident.message,
        summary: incident.summary,
        severity: incident.severity,
        categories: incident.categories,
        location: incident.gps ? { lat: incident.gps.lat, lon: incident.gps.lon } : undefined,
        agency: plan.agency,
        priorityScore: Number(
          (
            (typeof plan.priority === "number" && Number.isFinite(plan.priority)
              ? Math.max(0, Math.min(100, plan.priority))
              : incident.priorityScore * 12)
          ).toFixed(2),
        ),
        dispatchInstruction: plan.dispatchInstruction ?? incident.dispatchInstruction,
        responders: [responder],
        generatedAt: new Date().toISOString(),
      });
    }

    recommendations.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      overview: {
        totalIncidentsReviewed: incidentRows.length,
        recommendationsCount: recommendations.length,
        highSeverityCount: recommendations.filter((r) => r.severity >= 4).length,
        agencyDemand: demand,
      },
      recommendations,
      planner: {
        mode: "gemini-agentic",
        notes:
          parsed.plannerNotes.length > 0
            ? parsed.plannerNotes
            : [
                "Gemini dispatch planner used triage severity, hotspot activity, and responder availability.",
              ],
      },
    };
  },
};
