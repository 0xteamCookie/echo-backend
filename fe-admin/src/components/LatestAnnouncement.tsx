"use client";

import React from "react";
import useSWR from "swr";
import { Megaphone, MapPin, Clock } from "lucide-react";
import { useAuth } from "../lib/auth/provider";
import { apiUrl } from "../lib/api";

type Announcement = {
  id: string;
  message: string;
  locationName: string;
  createdAt: string;
};

type AnnouncementsPayload = {
  announcements: Announcement[];
  fetchedAt: string;
  error?: string;
};

const dummyData: AnnouncementsPayload = {
  announcements: [
    {
      id: "1",
      message: "Water supply will be temporarily unavailable from 2 PM to 4 PM due to maintenance work.",
      locationName: "Building A - Main Campus",
      createdAt: new Date().toISOString(),
    },
  ],
  fetchedAt: new Date().toISOString(),
};

export default function LatestAnnouncement() {
  const { authHeader } = useAuth();
  const authValue = authHeader.Authorization ?? "";

  const queryKey = authValue ? ([apiUrl("/api/announcement?limit=1"), authValue] as const) : null;

  const { data, error, isLoading } = useSWR<AnnouncementsPayload>(
    queryKey,
    async ([url, authorization]: readonly [string, string]) => {
      const res = await fetch(url, { headers: { Authorization: authorization } });
      const payload = (await res.json()) as AnnouncementsPayload;
      if (!res.ok) throw new Error(payload.error ?? "Failed to load latest announcement");
      return payload;
    },
    { refreshInterval: 50000, revalidateOnFocus: false },
  );

  if (isLoading) {
    return (
      <div className="bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl p-4 flex items-center gap-3 w-full animate-pulse h-[78px]">
        <div className="bg-orange-200 rounded-full h-10 w-10"></div>
        <div className="flex flex-col gap-2 w-full">
          <div className="h-4 bg-orange-200 rounded w-1/4"></div>
          <div className="h-3 bg-orange-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !data || !data.announcements || data.announcements.length === 0) {
    return (
        <div className="bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl p-4 flex items-start gap-4 shadow-sm w-full">
      <div className="flex-shrink-0 bg-orange-100 p-2 rounded-full text-orange-600 mt-0.5">
        <Megaphone size={20} />
      </div>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <h4 className="font-semibold text-[15px] truncate">Latest Public Announcement</h4>
          <span className="text-[12px] font-medium text-orange-700/80 shrink-0 flex items-center gap-1.5 bg-orange-100 px-2.5 py-0.5 rounded-full">
             <Clock size={12} /> 
          </span>
        </div>
        <p className="text-[14px] text-orange-800 leading-relaxed pr-6 mt-1">
          Unable to Fetch latest Message
        </p>
      </div>
    </div>
    );
  }

  const latest = data.announcements[0];
  const timeStr = new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl p-4 flex items-start gap-4 shadow-sm w-full">
      <div className="flex-shrink-0 bg-orange-100 p-2 rounded-full text-orange-600 mt-0.5">
        <Megaphone size={20} />
      </div>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <h4 className="font-semibold text-[15px] truncate">Latest Public Announcement</h4>
          <span className="text-[12px] font-medium text-orange-700/80 shrink-0 flex items-center gap-1.5 bg-orange-100 px-2.5 py-0.5 rounded-full">
             <Clock size={12} /> {timeStr}
          </span>
        </div>
        <p className="text-[14px] text-orange-800 leading-relaxed pr-6 mt-1">
          {latest.message}
        </p>
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-orange-700 mt-2">
          <MapPin size={13} />
          {latest.locationName}
        </div>
      </div>
    </div>
  );
}