import React from "react";
import AnnouncementPanel from "../../components/AnnouncementPanel";

export default function AnnouncementPage() {
  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">
            Announcements
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Publish location-specific announcements and monitor messages within
            a 1km area.
          </p>
        </div>
      </div>
      <div className="flex-1">
        <AnnouncementPanel />
      </div>
    </>
  );
}
