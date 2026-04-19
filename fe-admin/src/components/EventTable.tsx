import React from "react";
import { cn } from "./StatCard";

const mockIncidents = [
  { id: "M", code: "INC-2041", loc: "Sector 4", severity: 5, status: "Dispatching", time: "2 min" },
  { id: "F", code: "INC-2042", loc: "Factory Dist.", severity: 4, status: "On Route", time: "10 min" },
  { id: "P", code: "INC-2044", loc: "Shelter B", severity: 3, status: "Pending", time: "14 min" }
];

export default function EventTable() {
  return (
    <div className="bg-[#FAFAFA] rounded-2xl p-6 border border-[#FAFAFA] h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[14px] text-gray-800">Recent Dispatch</h3>
        <button className="text-[12px] font-medium text-gray-500 hover:text-black transition-colors bg-white px-3 py-1 rounded-full shadow-sm">View All</button>
      </div>
      
      <div className="flex-1">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200">
              <th className="pb-3 font-medium">Type</th>
              <th className="pb-3 font-medium">ID / Loc</th>
              <th className="pb-3 font-medium">KPI</th>
              <th className="pb-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mockIncidents.map((inc) => (
              <tr key={inc.code} className="hover:bg-gray-50 transition-colors group">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                     <div className={cn(
                       "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                       inc.id === "M" ? "bg-blue-500" : inc.id === "F" ? "bg-orange-500" : "bg-black"
                     )}>
                       {inc.id}
                     </div>
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 text-[12px]">{inc.code}</span>
                    <span className="text-[10px] text-gray-500 truncate max-w-[100px]">{inc.loc}</span>
                  </div>
                </td>
                <td className="py-3">
                   <div className="flex gap-2">
                      <span className="bg-black text-white text-[10px] px-2 py-0.5 rounded-full">{inc.severity} Sev</span>
                      <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">{inc.time}</span>
                   </div>
                </td>
                <td className="py-3 text-right">
                  <span className={cn(
                    "text-[11px] font-bold",
                    inc.status === "Dispatching" ? "text-[#E63946]" : "text-gray-600"
                  )}>
                    {inc.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

