"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProvisionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dispatch");
  }, [router]);

  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-[13px] text-muted">
      Redirecting to unified dispatch console...
    </div>
  );
}
