"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldAlert, ChevronDown } from "lucide-react";
import { useAuth } from "../lib/auth/provider";

function initials(email: string): string {
  if (!email) return "??";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? email[0] ?? "?";
  const second = parts[1]?.[0] ?? email[1] ?? "";
  return (first + second).toUpperCase();
}

export default function Header() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    router.replace("/login");
  };

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white sticky top-0 z-10 w-full mb-6 border-b border-gray-100">
      <div className="flex items-center gap-3 text-[13px] text-gray-500">
        <ShieldAlert size={16} className="text-[#E63946]" />
        <span className="font-medium text-gray-700">DisasterOps</span>
        <span className="text-gray-300">/</span>
        <span className="capitalize">{session.role.replace("_", " ")}</span>
        {session.agencies.length > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-medium text-gray-600">
            {session.agencies.join(" · ")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#E63946]/10 text-[#E63946] font-bold text-[11px]">
              {initials(session.email ?? "")}
            </span>
            <span className="text-[13px] text-gray-700 font-medium max-w-[160px] truncate">
              {session.email || "admin"}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white shadow-lg py-1.5 text-[13px]"
              onMouseLeave={() => setOpen(false)}
            >
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="font-semibold text-gray-800 truncate">
                  {session.email}
                </div>
                <div className="text-[11px] text-gray-500 capitalize">
                  {session.role.replace("_", " ")}
                </div>
              </div>
              <button
                onClick={() => void handleLogout()}
                role="menuitem"
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
