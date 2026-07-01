import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import {
  Client as GoogleMapsClient,
  TravelMode,
  UnitSystem,
} from "@googlemaps/google-maps-services-js";
import { config } from "../../lib/config";
import { getFirestoreDb } from "../../lib/firebase";
import { log } from "../../lib/logger";
import { haversineMeters } from "../../lib/geo";
import type {
  AgencyScope,
  DeviceData,
  HeatmapPoint,
} from "../data/data.schema";
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
// P2-10: shortlist size increased to 5 per the action plan.
const SHORTLIST_SIZE = 5;

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
  | {
      incident: null;
      reason: "no_gps" | "low_severity" | "stale" | "resolved";
    };

type DecisionWithSource = DispatchDecision & { modelAssisted: boolean };

/**
 * P2-10: Firestore rescuer profile. `DUMMY_RESCUERS` is gone — live rescuers
 * come from the `rescuers` collection.
 */
type DbRescuer = {
  id: string;
  name: string;
  agency: AgencyScope;
  currentLocation: { lat: number; lng: number };
  onDuty: boolean;
  specialties: string[];
};

const AGENCY_TO_SOURCE_SYSTEM: Record<
  AgencyScope,
  RescuerProfile["sourceSystem"]
> = {
  medical: "Medical CAD",
  fire: "Fire Dispatch",
  police: "Police RMS",
};

let googleMapsClient: GoogleMapsClient | null = null;
function getGoogleMapsClient(): GoogleMapsClient {
  if (!googleMapsClient) {
    googleMapsClient = new GoogleMapsClient({});
  }
  return googleMapsClient;
}

function parseAgency(value: unknown): AgencyScope | undefined {
  if (typeof value !== "string") return undefined;
  const n = value.trim().toLowerCase();
  if (n === "medical" || n === "fire" || n === "police") return n;
  return undefined;
}

function docToRescuer(
  id: string,
  data: FirebaseFirestore.DocumentData,
): DbRescuer | null {
  const agency = parseAgency(data.agency);
  if (!agency) return null;
  const loc = data.currentLocation;
  if (!loc || typeof loc !== "object") return null;
  const rawLat = (loc as Record<string, unknown>).lat;
  const rawLng = (loc as Record<string, unknown>).lng;
  const lat = typeof rawLat === "number" ? rawLat : Number(rawLat);
  const lng = typeof rawLng === "number" ? rawLng : Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const specialties = Array.isArray(data.specialties)
    ? (data.specialties as unknown[])
        .map((x) => String(x).trim().toLowerCase())
        .filter((s) => s !== "")
    : [];
  return {
    id,
    name:
      typeof data.name === "string" && data.name.trim() !== "" ? data.name : id,
    agency,
    currentLocation: { lat, lng },
    onDuty: data.onDuty === true,
    specialties,
  };
}

/** Load on-duty rescuers from Firestore, optionally scoped to caller agencies. */
async function loadOnDutyRescuers(
  allowed: Set<AgencyScope>,
): Promise<DbRescuer[]> {
  const db = getFirestoreDb();
  const snap = await db
    .collection("rescuers")
    .where("onDuty", "==", true)
    .get();
  const out: DbRescuer[] = [];
  for (const doc of snap.docs) {
    const r = docToRescuer(doc.id, doc.data());
    if (r && allowed.has(r.agency)) out.push(r);
  }
  return out;
}

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
    if (typeof raw === "number" && Number.isFinite(raw))
      return Math.min(5, Math.max(1, Math.round(raw)));
  }
  return 1;
}

function summaryFromMeta(d: DeviceData): string {
  const tri = d.meta?.triage;
  if (tri && typeof tri === "object" && !Array.isArray(tri)) {
    const raw = (tri as { summary?: unknown }).summary;
    if (typeof raw === "string" && raw.trim() !== "")
      return raw.trim().slice(0, 200);
  }
  const msg = d.message.trim();
  return (msg || "Incident with limited details").slice(0, 200);
}

function ageMinutes(receivedAt: string): number {
  const ms = Date.now() - new Date(receivedAt).getTime();
  if (!Number.isFinite(ms)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.round(ms / 60000));
}

function inferAgencies(
  categories: string[],
  fallback?: AgencyScope,
): AgencyScope[] {
  const out = new Set<AgencyScope>();
  for (const category of categories) {
    if (category === "medical" || category === "fire" || category === "police")
      out.add(category);
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
  const current =
    hotspotCounts.get(
      hotspotKey(incident.location.lat, incident.location.lon),
    ) ?? 0;
  const all = [...hotspotCounts.values()].sort((a, b) => a - b);
  if (all.length === 0) return 1;
  const p50 = all[Math.floor(all.length * 0.5)] ?? 0;
  const p80 = all[Math.floor(all.length * 0.8)] ?? 0;
  if (current >= p80 && current > 0) return 3;
  if (current >= p50 && current > 0) return 2;
  return 1;
}

function nearbyActiveCount(
  incident: CandidateIncident,
  incidents: CandidateIncident[],
): number {
  let count = 0;
  for (const other of incidents) {
    if (other.id === incident.id) continue;
    const m = haversineMeters(incident.location, other.location);
    if (m <= 1500) count += 1;
  }
  return count;
}

function heatIntensity(
  incident: CandidateIncident,
  points: HeatmapPoint[],
): "low" | "medium" | "high" {
  const local = points.filter(
    (p) =>
      haversineMeters(incident.location, { lat: p.lat, lon: p.lon }) <= 2000,
  );
  if (local.length === 0) return "low";
  const avg = local.reduce((sum, p) => sum + p.weight, 0) / local.length;
  if (avg >= 4) return "high";
  if (avg >= 2) return "medium";
  return "low";
}

function baseLoad(_responder: DbRescuer): number {
  // P2-10: all on-duty rescuers from Firestore are treated as available (load 0).
  // The onDuty flag already excludes anyone assigned or off-shift.
  return 0;
}

function specialtyScore(
  incident: CandidateIncident,
  responder: DbRescuer,
): number {
  if (responder.specialties.length === 0) return 0;
  const cats = new Set(incident.categories.map((c) => c.toLowerCase()));
  let hits = 0;
  for (const s of responder.specialties) {
    if (cats.has(s)) hits += 1;
  }
  return hits;
}

/** Haversine-based ETA fallback: assume 450 m/min average (~27 km/h). */
function haversineEtaMinutes(
  incident: CandidateIncident,
  responder: DbRescuer,
): number {
  const m = haversineMeters(incident.location, {
    lat: responder.currentLocation.lat,
    lon: responder.currentLocation.lng,
  });
  return Math.max(1, Math.round(m / 450));
}

// P2-10 cost control: Distance Matrix is billed per origin-destination element,
// and the dashboard polls /recommendations frequently. Cache drive-time results
// per (incident location + rescuer set) for a short TTL so repeated polls reuse
// the same answer instead of re-billing every few seconds.
const DM_CACHE_TTL_MS = 60_000;
const dmCache = new Map<string, { at: number; etas: Array<number | null> }>();

/** Round coords so tiny GPS jitter still hits the same cache key. */
function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000; // ~110m grid
}

function dmCacheKey(
  incident: CandidateIncident,
  responders: DbRescuer[],
): string {
  const dest = `${roundCoord(incident.location.lat)},${roundCoord(incident.location.lon)}`;
  const origins = responders
    .map(
      (r) =>
        `${r.id}:${roundCoord(r.currentLocation.lat)},${roundCoord(r.currentLocation.lng)}`,
    )
    .sort()
    .join("|");
  return `${dest}=>${origins}`;
}

/**
 * Cached wrapper around the Distance Matrix call. Uses a monotonic clock so it
 * cannot be affected by wall-clock changes, and prunes stale entries lazily.
 */
async function driveTimesCached(
  incident: CandidateIncident,
  responders: DbRescuer[],
): Promise<Array<number | null>> {
  if (responders.length === 0) return [];
  const key = dmCacheKey(incident, responders);
  const now = Date.now();
  const hit = dmCache.get(key);
  if (hit && now - hit.at < DM_CACHE_TTL_MS) {
    return hit.etas;
  }
  const etas = await driveTimesViaDistanceMatrix(incident, responders);
  dmCache.set(key, { at: now, etas });
  // Opportunistic prune so the map can't grow unbounded.
  if (dmCache.size > 500) {
    for (const [k, v] of dmCache) {
      if (now - v.at >= DM_CACHE_TTL_MS) dmCache.delete(k);
    }
  }
  return etas;
}

/**
 * Query Distance Matrix for drive-time seconds from every rescuer origin to a
 * single incident destination. Returns `null` entries on per-row errors so the
 * caller can fall back to haversine for that slot.
 */
async function driveTimesViaDistanceMatrix(
  incident: CandidateIncident,
  responders: DbRescuer[],
): Promise<Array<number | null>> {
  if (responders.length === 0) return [];
  try {
    const client = getGoogleMapsClient();
    const resp = await client.distancematrix({
      params: {
        key: config.googleMapsApiKey,
        origins: responders.map((r) => ({
          lat: r.currentLocation.lat,
          lng: r.currentLocation.lng,
        })),
        destinations: [
          { lat: incident.location.lat, lng: incident.location.lon },
        ],
        mode: TravelMode.driving,
        units: UnitSystem.metric,
      },
      timeout: 4000,
    });
    const rows = resp.data.rows ?? [];
    return responders.map((_, i) => {
      const row = rows[i];
      const el = row?.elements?.[0];
      if (!el || el.status !== "OK" || !el.duration) return null;
      return Math.max(1, Math.round(el.duration.value / 60));
    });
  } catch (err) {
    log.warn("dispatch.distance_matrix_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return responders.map(() => null);
  }
}

function buildCandidateIncident(row: DeviceData): BuildIncidentResult {
  if (!row.gps) return { incident: null, reason: "no_gps" };
  if (
    typeof row.status === "string" &&
    row.status.trim().toLowerCase() === "resolved"
  ) {
    return { incident: null, reason: "resolved" };
  }
  const severity = severityFromMeta(row.meta);
  const age = ageMinutes(row.receivedAt);
  if (severity < INCIDENT_MIN_SEVERITY)
    return { incident: null, reason: "low_severity" };
  if (age > INCIDENT_MAX_AGE_MINUTES)
    return { incident: null, reason: "stale" };
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
    typeof parsed.confidenceLevel === "number" &&
    Number.isFinite(parsed.confidenceLevel)
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
  if (
    !brief.categories.includes(selected.agency) &&
    !brief.categories.includes("rescue")
  ) {
    const agencyMatch = brief.candidateResponders.find((c) =>
      brief.categories.includes(c.agency),
    );
    if (agencyMatch) safe.selectedResponderId = agencyMatch.id;
  }
  if (selected.currentLoad >= MAX_LOAD) safe.escalate = true;
  safe.confidenceLevel = Math.min(
    3,
    Math.max(1, Math.round(safe.confidenceLevel)),
  ) as 1 | 2 | 3;
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
  const selected = brief.candidateResponders.find(
    (c) => c.id === decision.selectedResponderId,
  );
  const fallback = brief.candidateResponders[0];
  const picked = selected ?? fallback;
  return {
    incidentId: incident.id,
    severity: incident.severity,
    selectedResponderId: picked.id,
    selectedResponderName: picked.name,
    selectedResponderSourceSystem: picked.sourceSystem,
    agency: picked.agency,
    etaMinutes: picked.etaMinutes,
    confidenceLevel: decision.confidenceLevel,
    rationale: decision.rationale,
    escalate: decision.escalate,
    modelAssisted: decision.modelAssisted,
    summary: incident.summary,
    provisioningPreset: {
      sub: picked.id,
      name: picked.name,
      role: picked.agency,
      agency: picked.agency,
      radiusM: Math.max(300, Math.round(picked.etaMinutes * 120)),
      lat: incident.location.lat,
      lng: incident.location.lon,
    },
  };
}

function pickAvailableResponder(
  brief: IncidentBrief,
  preferredResponderId: string,
  takenResponderIds: Set<string>,
): { responderId: string; hadToReassign: boolean } {
  if (!takenResponderIds.has(preferredResponderId)) {
    return { responderId: preferredResponderId, hadToReassign: false };
  }
  const fallback = brief.candidateResponders.find(
    (c) => !takenResponderIds.has(c.id),
  );
  if (fallback) {
    return { responderId: fallback.id, hadToReassign: true };
  }
  // If every shortlisted responder is already taken, keep the preferred one as
  // a last resort instead of dropping the incident entirely.
  return { responderId: preferredResponderId, hadToReassign: false };
}

export const dispatchService = {
  async recommend(params: {
    agencies?: AgencyScope[];
    maxIncidents?: number;
  }): Promise<DispatchRecommendationResponse> {
    const maxIncidents = Math.max(1, Math.min(25, params.maxIncidents ?? 10));

    const rows = await dataService.list({
      limit: 500,
      agencies:
        params.agencies && params.agencies.length > 0
          ? params.agencies
          : undefined,
    });
    const incidents: CandidateIncident[] = [];
    const dropped = { noGps: 0, lowSeverity: 0, stale: 0, resolved: 0 };
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
        if (built.reason === "resolved") dropped.resolved += 1;
      }
    }
    incidents.sort(
      (a, b) =>
        b.severity - a.severity ||
        ageMinutes(a.receivedAt) - ageMinutes(b.receivedAt),
    );
    const trimmedIncidents = incidents.slice(0, maxIncidents);

    const eligibilitySummary = {
      totalRows: rows.length,
      withGps,
      eligibleBeforeLimit: incidents.length,
      eligibleAfterLimit: trimmedIncidents.length,
      droppedNoGps: dropped.noGps,
      droppedLowSeverity: dropped.lowSeverity,
      droppedStale: dropped.stale,
      droppedResolved: dropped.resolved,
      thresholds: {
        minSeverity: INCIDENT_MIN_SEVERITY,
        maxAgeMinutes: INCIDENT_MAX_AGE_MINUTES,
      },
    };
    log.info("dispatch.eligibility_summary", eligibilitySummary);
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

    const allowed = new Set<AgencyScope>(
      params.agencies ?? ["medical", "fire", "police"],
    );
    // P2-10: fetch on-duty rescuers from Firestore instead of using a hardcoded list.
    const responders = await loadOnDutyRescuers(allowed);
    const hotspotCounts = buildHotspotCounts(rows);
    const heatmap = await dataService.heatmapPoints({
      limit: 400,
      agencies:
        params.agencies && params.agencies.length > 0
          ? params.agencies
          : undefined,
    });

    // P2-10: drive-time lookups are async and potentially billable — compute per incident
    // with a Distance Matrix call (when enabled + key present) and fall back to haversine
    // per-responder on failures or disabled flag.
    const useDm =
      config.distanceMatrixEnabled && config.googleMapsApiKey.trim() !== "";

    const briefPairs = await Promise.all(
      trimmedIncidents.map(async (incident) => {
        const riskTier = historicalRiskTier(incident, hotspotCounts);
        const agencyPool = responders.filter((r) =>
          incident.agencyHints.includes(r.agency),
        );
        if (agencyPool.length === 0) return null;

        const dmEtas = useDm
          ? await driveTimesCached(incident, agencyPool)
          : agencyPool.map(() => null);

        const scored = agencyPool
          .map((responder, idx) => {
            const dm = dmEtas[idx];
            const etaMinutes = dm ?? haversineEtaMinutes(incident, responder);
            const specialty = specialtyScore(incident, responder);
            return { responder, etaMinutes, specialty };
          })
          .sort((a, b) => {
            if (a.etaMinutes !== b.etaMinutes)
              return a.etaMinutes - b.etaMinutes;
            return b.specialty - a.specialty;
          })
          .slice(0, SHORTLIST_SIZE);

        const shortlist = scored.map(({ responder, etaMinutes }) => ({
          id: responder.id,
          name: responder.name,
          agency: responder.agency,
          sourceSystem: AGENCY_TO_SOURCE_SYSTEM[responder.agency],
          etaMinutes,
          currentLoad: baseLoad(responder),
        }));

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
      }),
    );

    const briefs = briefPairs.filter(
      (x): x is { incident: CandidateIncident; brief: IncidentBrief } =>
        x !== null,
    );

    let model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null =
      null;
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
    const takenResponderIds = new Set<string>();

    for (let i = 0; i < briefs.length; i += 1) {
      const pair = briefs[i];
      const decisionResult = decisions[i];
      const decision =
        decisionResult.status === "fulfilled"
          ? decisionResult.value
          : fallbackDecision(pair.brief);
      const picked = pickAvailableResponder(
        pair.brief,
        decision.selectedResponderId,
        takenResponderIds,
      );
      const finalDecision: DecisionWithSource = picked.hadToReassign
        ? {
            ...decision,
            selectedResponderId: picked.responderId,
            escalate: true,
            rationale: `${decision.rationale}; reassigned to avoid duplicate responder`,
          }
        : {
            ...decision,
            selectedResponderId: picked.responderId,
          };
      takenResponderIds.add(finalDecision.selectedResponderId);
      if (finalDecision.modelAssisted) modelAssistedCount += 1;
      else fallbackCount += 1;
      recommendations.push(
        toRecommendation(pair.incident, pair.brief, finalDecision),
      );
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

  /**
   * List rescuers from Firestore, optionally filtered by agency or on-duty.
   * Used by the admin UI's incident drawer to populate the "assign rescuer"
   * dropdown.
   */
  async listRescuers(params: {
    agency?: AgencyScope;
    onDuty?: boolean;
    allowedAgencies?: AgencyScope[];
  }): Promise<
    Array<{
      id: string;
      name: string;
      agency: AgencyScope;
      onDuty: boolean;
      currentLocation: { lat: number; lng: number };
      specialties: string[];
    }>
  > {
    const db = getFirestoreDb();
    let query: FirebaseFirestore.Query = db.collection("rescuers");
    if (params.onDuty !== undefined) {
      query = query.where("onDuty", "==", params.onDuty);
    }
    if (params.agency) {
      query = query.where("agency", "==", params.agency);
    }
    const snap = await query.get();
    const allowed =
      params.allowedAgencies && params.allowedAgencies.length > 0
        ? new Set(params.allowedAgencies)
        : null;
    const out: Array<{
      id: string;
      name: string;
      agency: AgencyScope;
      onDuty: boolean;
      currentLocation: { lat: number; lng: number };
      specialties: string[];
    }> = [];
    for (const doc of snap.docs) {
      const r = docToRescuer(doc.id, doc.data());
      if (!r) continue;
      if (allowed && !allowed.has(r.agency)) continue;
      out.push(r);
    }
    return out;
  },

  /**
   * Persist an admin's assignment of a rescuer to an incident. Writes to
   * `dispatches/{messageId}` and also mirrors the assignment onto the device
   * entry for quick reads from the heatmap.
   */
  async assignRescuer(params: {
    messageId: string;
    rescuerId: string;
    assignedBy: string;
    assignedByEmail?: string;
  }): Promise<{ ok: true; assignedAt: string }> {
    const db = getFirestoreDb();
    const rescuerSnap = await db
      .collection("rescuers")
      .doc(params.rescuerId)
      .get();
    if (!rescuerSnap.exists) {
      throw Object.assign(new Error("Rescuer not found"), { statusCode: 404 });
    }
    const rescuer = rescuerSnap.data() ?? {};
    const assignedAt = new Date().toISOString();
    const dispatchDoc = {
      messageId: params.messageId,
      rescuerId: params.rescuerId,
      rescuerName:
        typeof rescuer.name === "string" ? rescuer.name : params.rescuerId,
      rescuerAgency: typeof rescuer.agency === "string" ? rescuer.agency : null,
      assignedAt,
      assignedBy: params.assignedBy,
      assignedByEmail: params.assignedByEmail ?? null,
      status: "assigned" as const,
    };
    await db
      .collection("dispatches")
      .doc(params.messageId)
      .set(dispatchDoc, { merge: true });
    // Best-effort: mirror onto the device entry so /api/data responses reflect it.
    try {
      await db
        .collection("device_entries")
        .doc(params.messageId)
        .set(
          {
            assignment: {
              rescuerId: params.rescuerId,
              rescuerName: dispatchDoc.rescuerName,
              assignedAt,
              assignedBy: params.assignedBy,
            },
            status: "assigned",
          },
          { merge: true },
        );
    } catch (err) {
      log.warn("dispatch.assign.mirror_failed", {
        messageId: params.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { ok: true, assignedAt };
  },

  /**
   * Reseed dummy rescuers for local/dev testing.
   * First removes previously seeded dummy docs, then inserts a fresh set.
   */
  async seedDummyRescuers(): Promise<{ seeded: number; ids: string[] }> {
    const db = getFirestoreDb();
    const now = new Date().toISOString();
    const seedTag = "dispatch-dev-seed";
    const legacyDummyIds = [
      "med-alpha-01",
      "med-bravo-02",
      "fire-alpha-01",
      "fire-bravo-03",
      "police-alpha-11",
      "police-bravo-14",
    ];
    const seedSuffix = now.slice(11, 19).replace(/:/g, "");
    const jitter = () => (Math.random() - 0.5) * 0.03;
    const fixtures: Array<{
      id: string;
      name: string;
      agency: AgencyScope;
      currentLocation: { lat: number; lng: number };
      specialties: string[];
    }> = [
      {
        id: `med-alpha-${seedSuffix}`,
        name: "Dr. Asha Menon",
        agency: "medical",
        currentLocation: { lat: 12.9716 + jitter(), lng: 77.5946 + jitter() },
        specialties: ["medical", "critical", "trauma"],
      },
      {
        id: `med-bravo-${seedSuffix}`,
        name: "Paramedic Leo",
        agency: "medical",
        currentLocation: { lat: 12.9648 + jitter(), lng: 77.6021 + jitter() },
        specialties: ["medical", "first-aid"],
      },
      {
        id: `fire-alpha-${seedSuffix}`,
        name: "Lt. Rohan Fireteam",
        agency: "fire",
        currentLocation: { lat: 12.9782 + jitter(), lng: 77.5877 + jitter() },
        specialties: ["fire", "rescue"],
      },
      {
        id: `fire-bravo-${seedSuffix}`,
        name: "Engine 12",
        agency: "fire",
        currentLocation: { lat: 12.9592 + jitter(), lng: 77.5968 + jitter() },
        specialties: ["fire", "hazmat"],
      },
      {
        id: `police-alpha-${seedSuffix}`,
        name: "Inspector Kavya",
        agency: "police",
        currentLocation: { lat: 12.9754 + jitter(), lng: 77.6102 + jitter() },
        specialties: ["police", "crowd-control"],
      },
      {
        id: `police-bravo-${seedSuffix}`,
        name: "Patrol Unit P14",
        agency: "police",
        currentLocation: { lat: 12.9683 + jitter(), lng: 77.5815 + jitter() },
        specialties: ["police", "traffic"],
      },
    ];

    const seededSnap = await db
      .collection("rescuers")
      .where("seededBy", "==", seedTag)
      .get();
    const staleIds = new Set<string>([
      ...legacyDummyIds,
      ...seededSnap.docs.map((d) => d.id),
    ]);
    await Promise.all(
      [...staleIds].map((id) => db.collection("rescuers").doc(id).delete()),
    );

    await Promise.all(
      fixtures.map((r) =>
        db.collection("rescuers").doc(r.id).set(
          {
            name: r.name,
            agency: r.agency,
            currentLocation: r.currentLocation,
            specialties: r.specialties,
            onDuty: true,
            lastSeenAt: now,
            seededBy: seedTag,
            seededAt: now,
          },
          { merge: false },
        ),
      ),
    );
    return { seeded: fixtures.length, ids: fixtures.map((x) => x.id) };
  },
};
