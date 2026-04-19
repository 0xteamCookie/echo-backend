import React from "react";
import EventTable from "../../components/EventTable";

export default function LiveFeed() {
  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">Live Dispatch Feed</h1>
        </div>
      </div>
      <div className="bg-[#FAFAFA] rounded-2xl p-6 border border-[#FAFAFA] flex-1">
         <EventTable />
      </div>
    </>
  );
}

