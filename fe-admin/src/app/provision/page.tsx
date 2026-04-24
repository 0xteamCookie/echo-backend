"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProvisionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dispatch");
  }, [router]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-[13px] text-gray-600">
      Redirecting to unified dispatch console...
    </div>
  );
}
