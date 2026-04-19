"use client";
import React from "react";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./RealMap"), { ssr: false });

export default function MapHeatmap() {
  return (
    <div className="bg-[#FFFFFF] rounded-2xl border border-[#FAFAFA] shadow-sm h-full flex flex-col relative overflow-hidden group">
      <div className="flex justify-between items-center relative z-10 w-full bg-white/80 p-4 border-b border-gray-100 shadow-sm">
        <h3 className="font-semibold text-[14px] text-gray-800">Live Operations Map</h3>
        <select className="text-[12px] bg-[#f6f6f6] border-none rounded-full px-3 py-1 cursor-pointer focus:outline-none">
          <option>View: Heatmap</option>
          <option>View: Clusters</option>
        </select>
      </div>
      
      <div className="flex-1 flex flex-col relative z-0">
          <MapComponent />
      </div>
    </div>
  );
}

