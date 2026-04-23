import React from "react";
import Link from "next/link";
import { Activity, BrainCircuit, Megaphone, Map, QrCode } from "lucide-react";

/**
 * Overview page (P1-10).
 *
 * The previous implementation rendered hardcoded numbers ("1,204 total
 * incidents", etc.) that had no relationship to real data. Those mocks were
 * removed; this page now links to the five working dashboard surfaces.
 *
 * Replaced in P2 by live aggregates from Firestore + BigQuery / Looker Studio.
 */
export default function Dashboard() {
  return (
    <>
      <div className="flex justify-between items-center bg-white mb-2 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">DisasterOps</h1>
          <p className="text-[13px] text-gray-500 mt-1">Live SOS mesh · admin console</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickLink
          href="/live-feed"
          icon={<Activity size={18} />}
          title="Live Feed"
          description="Every device report as it lands in Firestore."
        />
        <QuickLink
          href="/map"
          icon={<Map size={18} />}
          title="Operations Map"
          description="Geospatial view of active SOS events and responders."
        />
        <QuickLink
          href="/dispatch"
          icon={<BrainCircuit size={18} />}
          title="Agentic Dispatch"
          description="Gemini-scored assignments and responder suggestions."
        />
        <QuickLink
          href="/announcement"
          icon={<Megaphone size={18} />}
          title="Announcements"
          description="Broadcast evacuation or safety alerts into the mesh."
        />
        <QuickLink
          href="/provision"
          icon={<QrCode size={18} />}
          title="Rescuer QR"
          description="Issue signed JWTs to rescuer devices."
        />
      </div>
    </>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-sm hover:border-gray-300 transition-all"
    >
      <div className="flex items-center gap-2 text-[#E63946]">
        {icon}
        <span className="text-[14px] font-semibold text-gray-900">{title}</span>
      </div>
      <p className="text-[13px] text-gray-500 leading-relaxed">{description}</p>
    </Link>
  );
}
