import React from "react";
import EventTable from "../../components/EventTable";
import DataCard from "../../components/DataCard";

export default function MedicalReports() {
  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">Medical Reports</h1>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 bg-[#FAFAFA] p-6 rounded-2xl border border-[#FAFAFA] mb-6">
        <div className="col-span-12 lg:col-span-3 flex flex-col justify-center">
          <span className="text-[14px] font-semibold text-gray-600 mb-1">Total Medical</span>
          <div className="flex items-end gap-3">
              <h2 className="text-[42px] font-bold tracking-tighter leading-none">512</h2>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-9 flex gap-4 overflow-x-auto pb-2">
            <DataCard title="Critical" value="56" trend="12" trendDir="up" highlighted />
            <DataCard title="Ambulances Deployed" value="38" trend="2" trendDir="down" />
        </div>
      </div>
      
      <div className="flex-1 min-h-[400px]">
         <EventTable />
      </div>
    </>
  );
}
