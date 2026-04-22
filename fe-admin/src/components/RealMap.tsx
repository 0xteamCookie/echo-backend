"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useAuth } from "../lib/auth/provider";
import {
  useRealtimeEvents,
  FIRESTORE_NO_CLIENT,
  type DeviceEntry,
} from "../hooks/useRealtimeEvents";
import IncidentDrawer from "./IncidentDrawer";

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
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        // Small translucent red dot so the heatmap behind stays visible.
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#E63946",
          fillOpacity: 0.85,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
        cursor: "pointer",
        clickable: true,
        // Critical: keep the map's pan/zoom untouched on click.
      });
      marker.addListener("click", () => onSelect(entry));
      markersRef.current.push(marker);
    }

    return () => {
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
    };
  }, [map, items, onSelect]);

  return null;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RealMap() {
  const { authHeader } = useAuth();
  const { events, error } = useRealtimeEvents({ limit: 200 });
  const [fallbackPoints, setFallbackPoints] = useState<HeatPoint[]>([]);
  const [selected, setSelected] = useState<DeviceEntry | null>(null);

  const handleSelect = useCallback((entry: DeviceEntry) => {
    setSelected(entry);
  }, []);

  // Fallback: poll REST when Firestore client SDK is not configured.
  useEffect(() => {
    if (error !== FIRESTORE_NO_CLIENT) return;

    let isActive = true;

    async function fetchHeatmap() {
      try {
        const res = await fetch("/api/data/heatmap?limit=200", {
          headers: authHeader,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
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
      } catch (e) {
        console.error("Heatmap fetch error", e);
      }
    }

    void fetchHeatmap();
    const interval = setInterval(() => {
      if (isActive) void fetchHeatmap();
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

  const clickableEntries = useMemo<ClickableEntry[]>(() => {
    if (error === FIRESTORE_NO_CLIENT) return [];
    return events
      .map(entryToClickable)
      .filter((c): c is ClickableEntry => c !== null);
  }, [events, error]);

  if (!GOOGLE_MAPS_API_KEY) {
    return <ConfigureKeyPanel />;
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["visualization"]}>
        <Map
          defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="echo-admin-map"
          style={{ width: "100%", height: "100%" }}
        >
          <HeatmapOverlay points={points} />
          <IncidentMarkers items={clickableEntries} onSelect={handleSelect} />
        </Map>
      </APIProvider>
      <IncidentDrawer
        entry={selected}
        onClose={() => setSelected(null)}
        authHeader={authHeader}
      />
    </div>
  );
}
