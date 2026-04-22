"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BrainCircuit,
  Megaphone,
  Map,
  Settings,
  Folder,
  LayoutGrid,
  ShieldAlert,
  QrCode,
} from "lucide-react";
import { can } from "../lib/auth/permissions";
import { useAuth } from "../lib/auth/provider";

export default function Sidebar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const showMedical = session.agencies.includes("medical");
  const showFire = session.agencies.includes("fire");
  const showPolice = session.agencies.includes("police");

  return (
    <aside className="w-[240px] h-screen bg-[#F8F8F8] flex flex-col border-r border-[#EBEBEB]">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white">
          <ShieldAlert size={18} />
        </div>
        <span className="font-bold text-[15px]">DisasterOps</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="mb-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-3 px-2 tracking-wider">Dashboard</p>
          <nav className="flex flex-col gap-0.5">
            <NavItem href="/" icon={<LayoutGrid size={16} />} label="Overview" active={pathname === "/"} />
            <NavItem href="/live-feed" icon={<Activity size={16} />} label="Live Feed" active={pathname === "/live-feed"} />
            <NavItem
              href="/dispatch"
              icon={<BrainCircuit size={16} />}
              label="Agentic Dispatch"
              active={pathname === "/dispatch"}
            />
            <NavItem
              href="/announcement"
              icon={<Megaphone size={16} />}
              label="Announcements"
              active={pathname === "/announcement"}
            />
            <NavItem href="/map" icon={<Map size={16} />} label="Operations Map" active={pathname === "/map"} />
          </nav>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-3 px-2 tracking-wider">Field access</p>
          <nav className="flex flex-col gap-0.5">
            {can(session, "provision:issue") && (
              <NavItem
                href="/provision"
                icon={<QrCode size={16} />}
                label="Rescuer QR"
                active={pathname === "/provision"}
              />
            )}
          </nav>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-3 px-2 tracking-wider">Reports</p>
          <nav className="flex flex-col gap-0.5">
            {showMedical && (
              <NavItem
                href="/medical"
                icon={<Folder size={16} />}
                label="Medical"
                active={pathname === "/medical"}
              />
            )}
            {showFire && (
              <NavItem
                href="/fire-rescue"
                icon={<Folder size={16} />}
                label="Fire & Rescue"
                active={pathname === "/fire-rescue"}
              />
            )}
            {showPolice && (
              <NavItem
                href="/police"
                icon={<Folder size={16} />}
                label="Police"
                active={pathname === "/police"}
              />
            )}
          </nav>
        </div>
      </div>

      <div className="p-4 mt-auto">
        {can(session, "settings:read") && (
          <NavItem
            href="/settings"
            icon={<Settings size={16} />}
            label="Settings"
            active={pathname === "/settings"}
          />
        )}
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, active, badge }: { href: string, icon: React.ReactNode, label: string, active?: boolean, badge?: number }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[14px] ${
        active ? "bg-white shadow-sm font-medium text-black" : "hover:bg-gray-200 text-gray-600 hover:text-black"
      }`}
    >
      <span className={active ? "text-[#E63946]" : "text-gray-400"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="bg-[#E63946] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}
