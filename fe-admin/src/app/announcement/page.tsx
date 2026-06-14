import React from "react";
import AnnouncementPanel from "../../components/AnnouncementPanel";
import PageHeader from "../../components/PageHeader";

export default function AnnouncementPage() {
  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Publish location-specific announcements and monitor messages within a 1km area."
        info={
          <>
            Broadcast public-safety messages tied to a precise location. Pick a
            point from the live heatmap on the left — the orange circle shows
            the <strong className="text-ink">1km delivery radius</strong> — then
            write and publish. The right panel lists announcements already sent
            within 1km of the selected point so you can avoid duplicates.
          </>
        }
      />
      <div className="flex-1">
        <AnnouncementPanel />
      </div>
    </>
  );
}
