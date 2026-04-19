import React from "react";
import DataCard from "../components/DataCard";
import EventTable from "../components/EventTable";
import MapHeatmap from "../components/Map";
import { EventBarChart, IncidentTrendChart } from "../components/Charts";

export default function Dashboard() {
  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">Active Operations</h1>
        </div>
        <div className="flex gap-3 bg-[#F6F6F6] rounded-full p-1 items-center">
          <span className="text-[12px] font-medium text-black px-3">Timeframe</span>
          <div className="bg-white rounded-full px-4 py-1.5 shadow-sm text-[12px] font-medium flex items-center cursor-pointer">
              Nov 1 - Nov 30, 2026 <span className="ml-2 text-gray-400">▼</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 bg-[#FAFAFA] p-6 rounded-2xl border border-[#FAFAFA]">
        <div className="col-span-12 lg:col-span-3 flex flex-col justify-center">
          <span className="text-[14px] font-semibold text-gray-600 mb-1">Total Incidents</span>
          <div className="flex items-end gap-3">
              <h2 className="text-[42px] font-bold tracking-tighter leading-none">1,204</h2>
              <span className="bg-[#FFE8EC] text-[#E63946] text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1">↑ 12%</span>
          </div>
          <p className="text-[12px] text-gray-400 mt-2">vs prev. 1,075 (last month)</p>
        </div>
        
        <div className="col-span-12 lg:col-span-9 flex gap-4 overflow-x-auto pb-2">
            <DataCard title="Critical" value="142" trend="15" trendDir="up" subtitle="new" highlighted />
            <DataCard title="Medical" value="512" trend="8%" trendDir="down" />
            <DataCard title="Fire/Rescue" value="230" trend="5%" trendDir="up" />
            <DataCard title="Police" value="320" trend="2%" trendDir="down" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 bg-[#FAFAFA] rounded-2xl p-6 flex flex-col border border-[#FAFAFA]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-[14px] font-semibold text-gray-700">Incidents by Type</h3>
                <span className="text-gray-400">▼</span>
            </div>
            <EventBarChart />
          </div>
          
          <div className="col-span-12 lg:col-span-8 bg-[#FAFAFA] rounded-2xl p-6 flex flex-col border border-[#FAFAFA]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-[14px] font-semibold text-gray-700">Resolution Trend</h3>
                <div className="flex items-center gap-4 text-[12px]">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E63946]"></span> Active</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-black"></span> Resolved</div>
                </div>
            </div>
            <IncidentTrendChart />
          </div>
      </div>
      
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
            <EventTable />
        </div>
        <div className="col-span-12 lg:col-span-5 h-[400px]">
            <MapHeatmap />
        </div>
      </div>
    </>
  );
}

