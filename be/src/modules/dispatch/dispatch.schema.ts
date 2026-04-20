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

export type DispatchRecommendation = {
  incidentId: string;
  message: string;
  summary: string;
  severity: number;
  categories: string[];
  location?: { lat: number; lon: number };
  agency: AgencyScope;
  priorityScore: number;
  dispatchInstruction: string;
  responders: RecommendedResponder[];
  generatedAt: string;
};

export type DispatchOverview = {
  totalIncidentsReviewed: number;
  recommendationsCount: number;
  highSeverityCount: number;
  agencyDemand: Record<AgencyScope, number>;
};

export type DispatchRecommendationResponse = {
  overview: DispatchOverview;
  recommendations: DispatchRecommendation[];
  planner: {
    mode: "gemini-agentic" | "heuristic-agentic";
    notes: string[];
  };
};
