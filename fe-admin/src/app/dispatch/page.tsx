import React from "react";
import AgenticDispatchPanel from "../../components/AgenticDispatchPanel";

export default function DispatchPage() {
  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">
            Agentic Dispatch
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Gemini-powered recommendations using triage signals, live heatmap pressure, and incident location history.
          </p>
        </div>
      </div>
      <div className="flex-1">
        <AgenticDispatchPanel />
      </div>
    </>
  );
}
