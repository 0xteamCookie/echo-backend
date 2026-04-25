import React from "react";
import MapHeatmap from "../components/Map";
import LatestAnnouncement from "../components/LatestAnnouncement";

/**
 * Overview page (P1-10).
 *
 * The previous implementation rendered hardcoded numbers ("1,204 total
 * incidents", etc.) that had no relationship to real data. Those mocks were
 * removed; this page now links to the five working dashboard surfaces.
 *
 * Replaced in P2 by live aggregates from Firestore + BigQuery / Looker Studio.
 */
export default function Dashboard() {
  return (
    <>
      <div className="flex justify-between items-center bg-white">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">DisasterOps</h1>
          <p className="text-[13px] text-gray-500 mt-1">Live SOS mesh · admin console</p>
        </div>
      </div>

      <LatestAnnouncement />

      <div className="flex-1 min-h-[600px] rounded-2xl border-2 border-gray-300 overflow-hidden relative">
        <MapHeatmap />
      </div>
    </>
  );
}
