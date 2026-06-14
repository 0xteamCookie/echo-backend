"use client";

import React from "react";

export default function AccessDenied({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/10 p-6 mt-4">
      <h2 className="text-[22px] font-semibold text-danger">{title}</h2>
      <p className="text-[14px] text-danger mt-2">{detail}</p>
    </div>
  );
}
