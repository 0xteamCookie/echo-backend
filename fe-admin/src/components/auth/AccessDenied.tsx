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
    <div className="rounded-2xl border border-red-100 bg-red-50 p-6 mt-4">
      <h2 className="text-[22px] font-semibold text-red-800">{title}</h2>
      <p className="text-[14px] text-red-700 mt-2">{detail}</p>
    </div>
  );
}
