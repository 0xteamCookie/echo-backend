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
  LayoutGrid,
  Radio,
} from "lucide-react";
import { can } from "../lib/auth/permissions";
import { useAuth } from "../lib/auth/provider";

export default function Sidebar() {
  const pathname = usePathname();
  const { session } = useAuth();

  return (
    <aside className="w-[240px] h-screen bg-surface flex flex-col border-r border-border">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center text-white shadow-lg shadow-brand/30">
          <Radio size={18} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-bold text-[16px] text-ink tracking-tight">
            Echo
          </span>
          <span className="text-[10px] text-muted uppercase tracking-[0.2em]">
            Command
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="mb-6">
          <p className="text-[11px] font-semibold text-muted uppercase mb-3 px-2 tracking-wider">
            Dashboard
          </p>
          <nav className="flex flex-col gap-0.5">
            <NavItem
              href="/"
              icon={<LayoutGrid size={16} />}
              label="Overview"
              active={pathname === "/"}
            />
            <NavItem
              href="/live-feed"
              icon={<Activity size={16} />}
              label="Live Feed"
              active={pathname === "/live-feed"}
            />
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
            <NavItem
              href="/map"
              icon={<Map size={16} />}
              label="Operations Map"
              active={pathname === "/map"}
            />
          </nav>
        </div>

        {/* P1-10: per-agency report pages were 100% hardcoded mocks and were
            removed. Replace with real Looker Studio embeds in P2-9. */}
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

function NavItem({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[14px] ${
        active
          ? "bg-elevated font-medium text-ink"
          : "text-muted hover:bg-elevated/60 hover:text-ink"
      }`}
    >
      <span className={active ? "text-brand" : "text-muted"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="bg-brand text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}
