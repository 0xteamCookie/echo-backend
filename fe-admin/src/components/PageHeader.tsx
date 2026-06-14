"use client";

import React, { useState } from "react";
import { Info, X } from "lucide-react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Short explanation of what this page does — surfaced via the (i) button. */
  info?: React.ReactNode;
  /** Optional leading icon shown next to the title. */
  icon?: React.ReactNode;
  /** Optional right-aligned actions (buttons, filters, …). */
  actions?: React.ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  info,
  icon,
  actions,
}: PageHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-2 pb-4">
      <div className="relative">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-brand">{icon}</span>}
          <h1 className="text-[28px] font-semibold text-ink tracking-tight">
            {title}
          </h1>
          {info && (
            <button
              type="button"
              aria-label="About this page"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                open
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-border text-muted hover:border-brand/60 hover:text-brand"
              }`}
            >
              <Info size={14} />
            </button>
          )}
        </div>
        {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}

        {info && open && (
          <>
            <button
              aria-label="Close info"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <div
              role="dialog"
              className="absolute left-0 top-full z-40 mt-2 w-[min(420px,90vw)] rounded-xl border border-border bg-elevated p-4 shadow-2xl shadow-black/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand">
                  <Info size={13} />
                  About this page
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 text-muted hover:bg-surface hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mt-2 text-[13px] leading-relaxed text-muted">
                {info}
              </div>
            </div>
          </>
        )}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
