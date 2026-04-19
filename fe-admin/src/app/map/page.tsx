import React from "react";
import MapHeatmap from "../../components/Map";

export default function MapPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">Operations Map</h1>
        </div>
      </div>
      <div className="flex-1 min-h-[600px] h-full">
         <MapHeatmap />
      </div>
    </div>
  );
}
