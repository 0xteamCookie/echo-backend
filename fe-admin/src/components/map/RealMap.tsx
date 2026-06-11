/// <reference types="@types/google.maps" />
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { useAuth } from "../../lib/auth/provider";
import { apiUrl } from "../../lib/api";
import {
  useRealtimeEvents,
  FIRESTORE_NO_CLIENT,
  type DeviceEntry,
} from "../../hooks/useRealtimeEvents";
import {
  AutoFitToPoints,
  FocusPoint,
  HeatmapOverlay,
  IncidentMarkers,
} from "./overlays";
import { SosPanel } from "./SosPanel";
import {
  entryToClickable,
  entryToHeatPoint,
  isSosEntry,
  type ClickableEntry,
  type HeatPoint,
} from "./types";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };
const DEFAULT_ZOOM = 11;

function ConfigureKeyPanel() {
  return (
    <div className="w-full h-full rounded-xl border border-amber-300 bg-amber-50 p-6 flex flex-col items-center justify-center text-center gap-3">
      <div className="text-amber-700 font-semibold text-base">
        Google Maps API key is not configured
      </div>
      <div className="text-amber-800 text-sm max-w-md">
        Set{" "}
        <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </code>{" "}
        in{" "}
        <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
          echo-backend/fe-admin/.env.local
        </code>{" "}
        and restart{" "}
        <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
          next dev
        </code>{" "}
        to load the map.
      </div>
    </div>
  );
}

// REST fallback for environments where the Firestore client SDK isn't wired up.
function useFallbackEvents(enabled: boolean) {
  const { authHeader } = useAuth();
  const [events, setEvents] = useState<DeviceEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    async function pull() {
      try {
        const res = await fetch(apiUrl("/api/data?limit=200"), {
          headers: authHeader,
        });
        if (!res.ok || !active) return;
        const list = (await res.json()) as unknown;
        if (!Array.isArray(list)) return;
        const mapped: DeviceEntry[] = list.flatMap((item): DeviceEntry[] => {
          if (!item || typeof item !== "object" || Array.isArray(item))
            return [];
          const rec = item as Record<string, unknown>;
          const id = typeof rec.id === "string" ? rec.id : "";
          if (!id) return [];
          const gpsRaw = rec.gps as Record<string, unknown> | undefined;
          const gps =
            gpsRaw &&
            typeof gpsRaw === "object" &&
            typeof gpsRaw.lat === "number" &&
            typeof gpsRaw.lon === "number"
              ? { lat: gpsRaw.lat as number, lon: gpsRaw.lon as number }
              : undefined;
          const assignmentRaw = rec.assignment as
            | Record<string, unknown>
            | undefined;
          const assignment =
            assignmentRaw && typeof assignmentRaw === "object"
              ? {
                  rescuerId:
                    typeof assignmentRaw.rescuerId === "string"
                      ? (assignmentRaw.rescuerId as string)
                      : undefined,
                  rescuerName:
                    typeof assignmentRaw.rescuerName === "string"
                      ? (assignmentRaw.rescuerName as string)
                      : undefined,
                  assignedAt:
                    typeof assignmentRaw.assignedAt === "string"
                      ? (assignmentRaw.assignedAt as string)
                      : undefined,
                }
              : undefined;
          return [
            {
              id,
              macAddress:
                typeof rec.macAddress === "string" ? rec.macAddress : "",
              message: typeof rec.message === "string" ? rec.message : "",
              agency:
                rec.agency === "medical" ||
                rec.agency === "fire" ||
                rec.agency === "police"
                  ? rec.agency
                  : undefined,
              time: typeof rec.time === "string" ? rec.time : "",
              gps,
              meta:
                rec.meta &&
                typeof rec.meta === "object" &&
                !Array.isArray(rec.meta)
                  ? (rec.meta as Record<string, unknown>)
                  : undefined,
              receivedAt:
                typeof rec.receivedAt === "string"
                  ? rec.receivedAt
                  : new Date().toISOString(),
              status: typeof rec.status === "string" ? rec.status : undefined,
              assignment,
            },
          ];
        });
        if (active) setEvents(mapped);
      } catch (e) {
        console.error("Heatmap fetch error", e);
      }
    }

    void pull();
    const t = setInterval(() => {
      if (active) void pull();
    }, 4000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [enabled, authHeader]);

  return events;
}

export default function RealMap() {
  const { events, error } = useRealtimeEvents({ limit: 200 });
  const useFallback = error === FIRESTORE_NO_CLIENT;
  const fallbackEvents = useFallbackEvents(useFallback);

  const activeEvents = useFallback ? fallbackEvents : events;

  const [focusTarget, setFocusTarget] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const handleSelect = useCallback((entry: DeviceEntry) => {
    if (!entry.gps) return;
    setFocusTarget({ lat: entry.gps.lat, lng: entry.gps.lon });
  }, []);

  const points = useMemo<HeatPoint[]>(
    () =>
      activeEvents
        .map(entryToHeatPoint)
        .filter((p): p is HeatPoint => p !== null),
    [activeEvents],
  );

  const clickableEntries = useMemo<ClickableEntry[]>(
    () =>
      activeEvents
        .map(entryToClickable)
        .filter((c): c is ClickableEntry => c !== null),
    [activeEvents],
  );

  const recentReports = useMemo(() => {
    return activeEvents
      .filter((e) => Boolean(e.gps))
      .slice()
      .sort((a, b) => {
        const aSos = isSosEntry(a) ? 1 : 0;
        const bSos = isSosEntry(b) ? 1 : 0;
        if (aSos !== bSos) return bSos - aSos;
        const aTs = new Date(a.receivedAt || a.time).getTime();
        const bTs = new Date(b.receivedAt || b.time).getTime();
        return bTs - aTs;
      });
  }, [activeEvents]);

  const assignedCount = useMemo(
    () => activeEvents.filter((e) => Boolean(e.assignment?.rescuerId)).length,
    [activeEvents],
  );

  if (!GOOGLE_MAPS_API_KEY) return <ConfigureKeyPanel />;

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-100">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="echo-admin-map"
          style={{ width: "100%", height: "100%" }}
        >
          <HeatmapOverlay points={points} />
          <AutoFitToPoints points={points} padding={120} />
          <FocusPoint target={focusTarget} />
          <IncidentMarkers items={clickableEntries} onSelect={handleSelect} />
        </Map>
      </APIProvider>

      <SosPanel
        reports={recentReports}
        assignedCount={assignedCount}
        onSelect={handleSelect}
      />
    </div>
  );
}
