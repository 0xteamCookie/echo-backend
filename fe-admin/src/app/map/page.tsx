import React from "react";
import MapHeatmap from "../../components/Map";
import PageHeader from "../../components/PageHeader";

export default function MapPage() {
  return (
    <div className="flex flex-col h-full min-h-150">
      <PageHeader
        title="Operations Map"
        subtitle="Live SOS heatmap and incident feed."
        info={
          <>
            The full geospatial command view. Blue points are device reports
            sized by triage weight and clustered by density; orange/green
            markers are individual incidents (green = resolved, an{" "}
            <strong className="text-ink">A</strong> marker = already assigned).
            The panel on the right lists recent SOS and reports — click any
            point or row to focus it and open dispatch actions.
          </>
        }
      />
      <div className="flex-1 min-h-0">
        <MapHeatmap title={null} />
      </div>
    </div>
  );
}
