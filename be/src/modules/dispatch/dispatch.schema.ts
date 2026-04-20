import type { AgencyScope } from "../data/data.schema";

export type RescuerProfile = {
  id: string;
  name: string;
  agency: AgencyScope;
  sourceSystem: "Medical CAD" | "Fire Dispatch" | "Police RMS";
  location: { lat: number; lon: number };
  radiusM: number;
  status: "available" | "enroute" | "busy";
};

export type RecommendedResponder = {
  rescuerId: string;
  name: string;
  agency: AgencyScope;
  sourceSystem: RescuerProfile["sourceSystem"];
  etaMinutes: number;
  distanceMeters: number;
  status: RescuerProfile["status"];
  rationale: string;
};

export type CandidateResponderBrief = {
  id: string;
  name: string;
  agency: AgencyScope;
  sourceSystem: RescuerProfile["sourceSystem"];
  etaMinutes: number;
  currentLoad: number;
};

export type IncidentBrief = {
  incidentId: string;
  severity: number;
  categories: string[];
  summary: string;
  heatIntensity: "low" | "medium" | "high";
  nearbyActiveCount: number;
  historicalRiskTier: 1 | 2 | 3;
  candidateResponders: CandidateResponderBrief[];
};

export type DispatchDecision = {
  selectedResponderId: string;
  confidenceLevel: 1 | 2 | 3;
  rationale: string;
  escalate: boolean;
};

export type DispatchRecommendation = {
  incidentId: string;
  severity: number;
  selectedResponderId: string;
  selectedResponderName: string;
  selectedResponderSourceSystem: RescuerProfile["sourceSystem"];
  agency: AgencyScope;
  etaMinutes: number;
  confidenceLevel: 1 | 2 | 3;
  rationale: string;
  escalate: boolean;
  modelAssisted: boolean;
  summary: string;
  provisioningPreset: {
    sub: string;
    name: string;
    role: AgencyScope;
    agency: AgencyScope;
    radiusM: number;
    lat: number;
    lng: number;
  };
};

export type DispatchMeta = {
  totalIncidents: number;
  modelAssistedCount: number;
  fallbackCount: number;
};

export type DispatchRecommendationResponse = {
  generatedAt: string;
  recommendations: DispatchRecommendation[];
  meta: DispatchMeta;
};
