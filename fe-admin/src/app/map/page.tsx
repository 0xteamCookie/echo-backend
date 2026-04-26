import React from "react";
import MapHeatmap from "../../components/Map";

export default function MapPage() {
  return (
    <div className="flex flex-col h-full min-h-150">
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">
            Operations Map
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Live SOS heatmap and incident feed.
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MapHeatmap title={null} />
      </div>
    </div>
  );
}
