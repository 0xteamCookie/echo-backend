"use client";

import React, { useMemo } from "react";
import { BrainCircuit, RefreshCcw, Siren, Timer } from "lucide-react";
import useSWR from "swr";
import { useAuth } from "../lib/auth/provider";

type RecommendedResponder = {
  rescuerId: string;
  name: string;
  agency: "medical" | "fire" | "police";
  sourceSystem: string;
  etaMinutes: number;
  distanceMeters: number;
  status: "available" | "enroute" | "busy";
  rationale: string;
};

type DispatchRecommendation = {
  incidentId: string;
  summary: string;
  severity: number;
  categories: string[];
  agency: "medical" | "fire" | "police";
  priorityScore: number;
  dispatchInstruction: string;
  responders: RecommendedResponder[];
  generatedAt: string;
};

type DispatchPayload = {
  overview: {
    totalIncidentsReviewed: number;
    recommendationsCount: number;
    highSeverityCount: number;
    agencyDemand: { medical: number; fire: number; police: number };
  };
  planner: { mode: string; notes: string[] };
  recommendations: DispatchRecommendation[];
};

function agencyBadge(agency: "medical" | "fire" | "police"): string {
  if (agency === "medical") return "bg-blue-100 text-blue-700";
  if (agency === "fire") return "bg-orange-100 text-orange-700";
  return "bg-gray-200 text-gray-800";
}

export default function AgenticDispatchPanel() {
  const { authHeader } = useAuth();
  const authValue = authHeader.Authorization ?? "";
  const swrKey = authValue
    ? (["/api/dispatch/recommendations?limit=12", authValue] as const)
    : null;
  const { data: payload, error, isLoading, mutate } = useSWR<DispatchPayload>(
    swrKey,
    async ([url, authorization]: readonly [string, string]) => {
      const res = await fetch(url, {
        headers: { Authorization: authorization },
      });
      const data = (await res.json()) as DispatchPayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to fetch recommendations");
      }
      return data;
    },
    { refreshInterval: 12000, revalidateOnFocus: false },
  );

  const top = useMemo(() => payload?.recommendations.slice(0, 6) ?? [], [payload]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
            <BrainCircuit size={18} className="text-[#E63946]" />
            Agentic Dispatch Recommendations
          </h3>
          <p className="text-[12px] text-gray-500 mt-1">
            AI-assisted dispatch planner based on live triage context, heatmap intensity, and responder fit.
          </p>
          {payload && (
            <p className="text-[11px] text-gray-400 mt-1">
              Engine: <span className="font-semibold">{payload.planner.mode}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-medium hover:bg-gray-50"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      {payload && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#FAFAFA] border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500 uppercase">Incidents reviewed</p>
            <p className="text-[20px] font-semibold text-gray-900 mt-1">
              {payload.overview.totalIncidentsReviewed}
            </p>
          </div>
          <div className="rounded-xl bg-[#FAFAFA] border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500 uppercase">Active recommendations</p>
            <p className="text-[20px] font-semibold text-gray-900 mt-1">
              {payload.overview.recommendationsCount}
            </p>
          </div>
          <div className="rounded-xl bg-[#FAFAFA] border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500 uppercase">High severity (4+)</p>
            <p className="text-[20px] font-semibold text-[#E63946] mt-1">
              {payload.overview.highSeverityCount}
            </p>
          </div>
        </div>
      )}

      {isLoading && <p className="text-[13px] text-gray-500">Computing dispatch recommendations...</p>}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
          {error.message}
        </div>
      )}

      {!isLoading && !error && top.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[13px] text-gray-600">
          No actionable incidents found yet. As new events are triaged, dispatch suggestions will appear here.
        </div>
      )}

      {!isLoading && !error && top.length > 0 && (
        <div className="flex flex-col gap-3">
          {top.map((item) => (
            <div key={`${item.incidentId}-${item.agency}`} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${agencyBadge(item.agency)}`}>
                    {item.agency.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-gray-500">Incident {item.incidentId.slice(0, 8)}</span>
                </div>
                <div className="text-[11px] text-gray-600">
                  Priority <span className="font-semibold">{item.priorityScore.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[13px] font-semibold text-gray-900 mt-2">{item.summary}</p>
              <p className="text-[12px] text-gray-600 mt-1">{item.dispatchInstruction}</p>

              {item.responders.length > 0 ? (
                <div className="mt-3 rounded-lg bg-[#FAFAFA] border border-gray-100 p-2.5">
                  {item.responders.map((r) => (
                    <div key={r.rescuerId} className="flex items-center justify-between gap-2 text-[12px]">
                      <div className="flex items-center gap-2">
                        <Siren size={14} className="text-gray-500" />
                        <span className="font-medium text-gray-800">{r.name}</span>
                        <span className="text-gray-500">({r.sourceSystem})</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Timer size={13} />
                        <span>
                          ETA {r.etaMinutes}m | {Math.round(r.distanceMeters / 1000)}km
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-amber-700 mt-2">
                  No nearby responder candidate found in current roster.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {payload && payload.planner.notes.length > 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-[12px] text-gray-600">
          {payload.planner.notes[0]}
        </div>
      )}
    </div>
  );
}
