import React from "react";
import AgenticDispatchPanel from "../../components/AgenticDispatchPanel";
import EventTable from "../../components/EventTable";

export default function LiveFeed() {
  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">Live Dispatch Feed</h1>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-6 flex-1">
        <div className="col-span-12 xl:col-span-7 bg-border rounded-2xl p-6 border border-[#FAFAFA]">
          <EventTable />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <AgenticDispatchPanel />
        </div>
      </div>
    </>
  );
}

