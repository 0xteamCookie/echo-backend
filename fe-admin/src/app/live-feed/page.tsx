import React from "react";
import AgenticDispatchPanel from "../../components/AgenticDispatchPanel";
import EventTable from "../../components/EventTable";
import PageHeader from "../../components/PageHeader";

export default function LiveFeed() {
  return (
    <>
      <PageHeader
        title="Live Dispatch Feed"
        subtitle="Real-time incident stream alongside agentic dispatch recommendations."
        info={
          <>
            A live triage workspace. The left table streams the most recent
            incidents as they arrive from the device mesh; the right panel shows{" "}
            <strong className="text-ink">agentic dispatch recommendations</strong>{" "}
            — per-incident responder suggestions with ETA, confidence, and
            escalation flags. To actually issue credentials and assign a
            responder, use the <strong className="text-ink">Agentic Dispatch</strong>{" "}
            console.
          </>
        }
      />
      <div className="grid grid-cols-12 gap-6 flex-1">
        <div className="col-span-12 xl:col-span-7">
          <EventTable />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <AgenticDispatchPanel />
        </div>
      </div>
    </>
  );
}
