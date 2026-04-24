/// <reference types="@types/google.maps" />
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useAuth } from "../lib/auth/provider";
import { apiUrl } from "../lib/api";
import {
  useRealtimeEvents,
  FIRESTORE_NO_CLIENT,
  type DeviceEntry,
} from "../hooks/useRealtimeEvents";

// ─── Config & types ──────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const CATEGORY_WEIGHT: Record<string, number> = {
  medical: 1.0,
  fire: 1.5,
  police: 1.0,
  rescue: 1.2,
  broadcast: 0.8,
  unknown: 0.5,
};

type HeatPoint = { lat: number; lng: number; weight: number };

function entryToHeatPoint(entry: DeviceEntry): HeatPoint | null {
  if (!entry.gps) return null;
  const meta = entry.meta;
  let severity = 1;
  if (
    meta &&
    typeof meta.severity === "number" &&
    Number.isFinite(meta.severity)
  ) {
    severity = Math.min(5, Math.max(1, Math.round(meta.severity)));
  }
  const cat = entry.agency ?? "unknown";
  const weight =
    severity * (CATEGORY_WEIGHT[cat] ?? CATEGORY_WEIGHT.unknown);
  return { lat: entry.gps.lat, lng: entry.gps.lon, weight };
}

// ─── Heatmap overlay (imperative; uses visualization library) ────────────────

function HeatmapOverlay({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const visualization = useMapsLibrary("visualization");
  const layerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    if (!map || !visualization) return;

    if (!layerRef.current) {
      layerRef.current = new visualization.HeatmapLayer({
        map,
        radius: 28,
        opacity: 0.7,
      });
    }

    const data = points.map((p) => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      weight: Math.max(0.15, p.weight / 8),
    }));
    layerRef.current.setData(data);

    return () => {
      // Keep the layer alive across updates; only tear it down when the map
      // unmounts (the ref will be garbage-collected with the component).
    };
  }, [map, visualization, points]);

  useEffect(() => {
    return () => {
      layerRef.current?.setMap(null);
      layerRef.current = null;
    };
  }, []);

  return null;
}

// ─── Missing-key config panel ────────────────────────────────────────────────

function ConfigureKeyPanel() {
  return (
    <div className="w-full h-full rounded-xl border border-amber-300 bg-amber-50 p-6 flex flex-col items-center justify-center text-center gap-3">
      <div className="text-amber-700 font-semibold text-base">
        Google Maps API key is not configured
      </div>
      <div className="text-amber-800 text-sm max-w-md">
        Set <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
        in <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">echo-backend/fe-admin/.env.local</code>{" "}
        and restart <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">next dev</code> to load the map.
      </div>
      <div className="text-xs text-amber-600">
        The key must have the Maps JavaScript API enabled with HTTP referrer
        restrictions scoped to your admin host.
      </div>
    </div>
  );
}

// ─── Clickable incident markers ──────────────────────────────────────────────

type ClickableEntry = { entry: DeviceEntry; lat: number; lng: number };

function entryToClickable(entry: DeviceEntry): ClickableEntry | null {
  if (!entry.gps) return null;
  return { entry, lat: entry.gps.lat, lng: entry.gps.lon };
}

function IncidentMarkers({
  items,
  onSelect,
}: {
  items: ClickableEntry[];
  onSelect: (entry: DeviceEntry) => void;
}) {
  const map = useMap();
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map) return;
    // Clear old markers
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    for (const { entry, lat, lng } of items) {
      const assigned = Boolean(entry.assignment?.rescuerId);
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        // Keep incident marker color consistent; assignment is shown via badge + popup.
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#E63946",
          fillOpacity: 0.85,
          strokeColor: assigned ? "#111827" : "#ffffff",
          strokeWeight: assigned ? 2.5 : 1.5,
        },
        label: assigned
          ? {
              text: "A",
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "10px",
            }
          : undefined,
        title: entry.assignment?.rescuerName
          ? `Assigned: ${entry.assignment.rescuerName}`
          : "Unassigned incident",
        cursor: "pointer",
        clickable: true,
        // Critical: keep the map's pan/zoom untouched on click.
      });
      marker.addListener("click", () => {
        // Assigned markers are informational on-map; use the right sidebar to
        // inspect/open details without disruptive overlay clashes.
        if (assigned) return;
        onSelect(entry);
      });
      markersRef.current.push(marker);
    }

    return () => {
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
    };
  }, [map, items, onSelect]);

  return null;
}

function AutoFitToPoints({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!map || hasFittedRef.current || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, 80);
    hasFittedRef.current = true;
  }, [map, points]);

  return null;
}

function FocusPoint({
  target,
}: {
  target: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    const zoom = map.getZoom();
    if (typeof zoom !== "number" || zoom < 14) map.setZoom(14);
  }, [map, target]);

  return null;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RealMap() {
  const { authHeader } = useAuth();
  const { events, error } = useRealtimeEvents({ limit: 200 });
  const [fallbackPoints, setFallbackPoints] = useState<HeatPoint[]>([]);
  const [fallbackEvents, setFallbackEvents] = useState<DeviceEntry[]>([]);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number } | null>(null);

  const handleSelect = useCallback((entry: DeviceEntry) => {
    if (!entry.gps) return;
    setFocusTarget({ lat: entry.gps.lat, lng: entry.gps.lon });
  }, []);

  // Fallback: poll REST when Firestore client SDK is not configured.
  useEffect(() => {
    if (error !== FIRESTORE_NO_CLIENT) return;

    let isActive = true;

    async function fetchHeatmapAndEvents() {
      try {
        const heatmapRes = await fetch(apiUrl("/api/data/heatmap?limit=200"), { headers: authHeader });
        if (heatmapRes.ok) {
          const data = (await heatmapRes.json()) as {
          points?: Array<{ lat: number; lon: number; weight?: number }>;
          };
          if (data.points && Array.isArray(data.points) && isActive) {
            setFallbackPoints(
              data.points.map((p) => ({
                lat: p.lat,
                lng: p.lon,
                weight: p.weight ?? 1,
              })),
            );
          }
        }
        const eventsRes = await fetch(apiUrl("/api/data?limit=200"), { headers: authHeader });
        if (eventsRes.ok && isActive) {
          const list = (await eventsRes.json()) as unknown;
          const mapped: DeviceEntry[] = Array.isArray(list)
            ? list.flatMap((item): DeviceEntry[] => {
                if (!item || typeof item !== "object" || Array.isArray(item)) return [];
                const rec = item as Record<string, unknown>;
                const id = typeof rec.id === "string" ? rec.id : "";
                if (!id) return [];
                const gpsRaw = rec.gps;
                const gps =
                  gpsRaw &&
                  typeof gpsRaw === "object" &&
                  !Array.isArray(gpsRaw) &&
                  typeof (gpsRaw as Record<string, unknown>).lat === "number" &&
                  typeof (gpsRaw as Record<string, unknown>).lon === "number"
                    ? {
                        lat: (gpsRaw as Record<string, number>).lat,
                        lon: (gpsRaw as Record<string, number>).lon,
                      }
                    : undefined;
                const assignmentRaw = rec.assignment;
                const assignment =
                  assignmentRaw &&
                  typeof assignmentRaw === "object" &&
                  !Array.isArray(assignmentRaw)
                    ? {
                        rescuerId:
                          typeof (assignmentRaw as Record<string, unknown>).rescuerId === "string"
                            ? ((assignmentRaw as Record<string, unknown>).rescuerId as string)
                            : undefined,
                        rescuerName:
                          typeof (assignmentRaw as Record<string, unknown>).rescuerName === "string"
                            ? ((assignmentRaw as Record<string, unknown>).rescuerName as string)
                            : undefined,
                        assignedAt:
                          typeof (assignmentRaw as Record<string, unknown>).assignedAt === "string"
                            ? ((assignmentRaw as Record<string, unknown>).assignedAt as string)
                            : undefined,
                      }
                    : undefined;
                return [
                  {
                    id,
                    macAddress: typeof rec.macAddress === "string" ? rec.macAddress : "",
                    message: typeof rec.message === "string" ? rec.message : "",
                    agency:
                      rec.agency === "medical" || rec.agency === "fire" || rec.agency === "police"
                        ? rec.agency
                        : undefined,
                    time: typeof rec.time === "string" ? rec.time : "",
                    gps,
                    meta:
                      rec.meta && typeof rec.meta === "object" && !Array.isArray(rec.meta)
                        ? (rec.meta as Record<string, unknown>)
                        : undefined,
                    receivedAt: typeof rec.receivedAt === "string" ? rec.receivedAt : new Date().toISOString(),
                    status: typeof rec.status === "string" ? rec.status : undefined,
                    assignment,
                  },
                ];
              })
            : [];
          setFallbackEvents(mapped);
        }
      } catch (e) {
        console.error("Heatmap fetch error", e);
      }
    }

    void fetchHeatmapAndEvents();
    const interval = setInterval(() => {
      if (isActive) void fetchHeatmapAndEvents();
    }, 4000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [error, authHeader]);

  const realtimePoints = useMemo<HeatPoint[]>(() => {
    if (error === FIRESTORE_NO_CLIENT) return [];
    return events
      .map(entryToHeatPoint)
      .filter((p): p is HeatPoint => p !== null);
  }, [events, error]);

  const points =
    error === FIRESTORE_NO_CLIENT ? fallbackPoints : realtimePoints;

  const activeEvents = error === FIRESTORE_NO_CLIENT ? fallbackEvents : events;

  const clickableEntries = useMemo<ClickableEntry[]>(() => {
    return activeEvents
      .map(entryToClickable)
      .filter((c): c is ClickableEntry => c !== null);
  }, [activeEvents]);

  const assignedCalls = useMemo(() => {
    return activeEvents
      .filter((e) => Boolean(e.assignment?.rescuerId) && Boolean(e.gps))
      .sort((a, b) => {
        const aTs = a.assignment?.assignedAt ? new Date(a.assignment.assignedAt).getTime() : 0;
        const bTs = b.assignment?.assignedAt ? new Date(b.assignment.assignedAt).getTime() : 0;
        return bTs - aTs;
      });
  }, [activeEvents]);

  const focusAssigned = useCallback((entry: DeviceEntry) => {
    if (!entry.gps) return;
    setFocusTarget({ lat: entry.gps.lat, lng: entry.gps.lon });
  }, []);

  if (!GOOGLE_MAPS_API_KEY) {
    return <ConfigureKeyPanel />;
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 bg-[#FCFCFC]">
      <div className="xl:col-span-9 rounded-xl overflow-hidden border border-gray-200">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["visualization"]}>
          <Map
            defaultCenter={{ lat: 12.9716, lng: 77.5946 }}
            defaultZoom={11}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapId="echo-admin-map"
            style={{ width: "100%", height: "100%" }}
          >
            <HeatmapOverlay points={points} />
            <AutoFitToPoints points={points} />
            <FocusPoint target={focusTarget} />
            <IncidentMarkers items={clickableEntries} onSelect={handleSelect} />
          </Map>
        </APIProvider>
      </div>

      <aside className="xl:col-span-3 rounded-xl border border-gray-200 bg-white p-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
        <h3 className="text-[14px] font-semibold text-gray-900">Assigned Calls</h3>
        <p className="text-[12px] text-gray-500 mt-1">
          Incidents already assigned to responders.
        </p>
        {assignedCalls.length === 0 ? (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-[12px] text-gray-600">
            No assigned calls yet.
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {assignedCalls.slice(0, 50).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => focusAssigned(entry)}
                className="text-left rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50"
              >
                <p className="text-[12px] font-semibold text-gray-900">
                  {entry.assignment?.rescuerName ?? entry.assignment?.rescuerId ?? "Responder"}
                </p>
                <p className="text-[11px] text-gray-600 mt-1">Incident {entry.id.slice(0, 8)}</p>
                {entry.assignment?.assignedAt && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    {new Date(entry.assignment.assignedAt).toLocaleString()}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </aside>

    </div>
  );
}
