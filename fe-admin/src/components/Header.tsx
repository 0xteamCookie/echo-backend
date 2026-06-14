"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Radio, ChevronDown, Sun, Moon } from "lucide-react";
import { useAuth } from "../lib/auth/provider";
import { useTheme } from "../lib/theme";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isLight ? "dark" : "light"} theme`}
      title={`Switch to ${isLight ? "dark" : "light"} theme`}
      className="flex items-center justify-center w-9 h-9 rounded-full border border-border text-muted hover:bg-elevated hover:text-brand transition-colors"
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

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
    <header className="flex items-center justify-between px-8 py-4 bg-background/80 backdrop-blur sticky top-0 z-10 w-full mb-6 border-b border-border">
      <div className="flex items-center gap-3 text-[13px] text-muted">
        <Radio size={16} className="text-brand" />
        <span className="font-medium text-ink">Echo</span>
        <span className="text-border">/</span>
        <span className="capitalize">{session.role.replace("_", " ")}</span>
        {session.agencies.length > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-elevated text-[11px] font-medium text-muted">
            {session.agencies.join(" · ")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-elevated transition-colors"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand/15 text-brand font-bold text-[11px]">
              {initials(session.email ?? "")}
            </span>
            <span className="text-[13px] text-ink font-medium max-w-[160px] truncate">
              {session.email || "admin"}
            </span>
            <ChevronDown size={14} className="text-muted" />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-elevated shadow-2xl shadow-black/40 py-1.5 text-[13px]"
              onMouseLeave={() => setOpen(false)}
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="font-semibold text-ink truncate">
                  {session.email}
                </div>
                <div className="text-[11px] text-muted capitalize">
                  {session.role.replace("_", " ")}
                </div>
              </div>
              <button
                onClick={() => void handleLogout()}
                role="menuitem"
                className="w-full flex items-center gap-2 px-3 py-2 text-muted hover:bg-surface hover:text-ink"
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
