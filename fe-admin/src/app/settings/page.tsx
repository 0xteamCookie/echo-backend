import React from "react";

export default function SettingsPage() {
  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="bg-[#FAFAFA] rounded-2xl p-6 border border-[#FAFAFA] flex-1">
         <p className="text-gray-500">Configure dashboard preferences, map API keys, and notification rules here.</p>
      </div>
    </>
  );
}
