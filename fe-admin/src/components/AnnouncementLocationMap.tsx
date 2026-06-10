"use client";

import React, { useEffect, useMemo, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
  AdvancedMarker,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export type AnnouncementMapPoint = {
  key: string;
  name: string;
  lat: number;
  lon: number;
  weight?: number;
};

type Props = {
  points: AnnouncementMapPoint[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

const RADIUS_M = 1000;

// ─── Heatmap + selection circle (using marker clustering) ──────────────────

function HeatmapAndSelection({
  points,
  selectedPoint,
}: {
  points: AnnouncementMapPoint[];
  selectedPoint: AnnouncementMapPoint | null;
}) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const heatmapMarkersRef = useRef<google.maps.Marker[]>([]);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const hasFitted = useRef(false);

  // Heatmap layer using marker clustering.
  useEffect(() => {
    if (!map) return;

    // Initialize clusterer if not exists
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        algorithmOptions: {
          radius: 80,
        },
        renderer: {
          render: ({ count, position }) => {
            const intensity = Math.min(1, count / 100);
            const color = intensity > 0.7 ? "#dc2626" : intensity > 0.4 ? "#f97316" : "#16a34a";
            const size = Math.min(40, 20 + Math.log(count) * 3);
            return new google.maps.Marker({
              position,
              label: {
                text: String(count),
                color: "#fff",
                fontSize: "11px",
                fontWeight: "bold",
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: size / 2,
                fillColor: color,
                fillOpacity: 0.85,
                strokeColor: "#fff",
                strokeWeight: 2,
              },
            });
          },
        },
      });
    }

    // Create markers from heatmap points
    for (const m of heatmapMarkersRef.current) m.setMap(null);
    heatmapMarkersRef.current = [];

    const newMarkers = points.map(
      (p) =>
        new google.maps.Marker({
          position: { lat: p.lat, lng: p.lon },
          title: p.name,
          opacity: Math.min(1, 0.4 + (p.weight ?? 1) / 10),
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: Math.max(3, (p.weight ?? 1) / 2),
            fillColor: "#f59e0b",
            fillOpacity: 0.5,
            strokeColor: "#d97706",
            strokeWeight: 1,
          },
        }),
    );

    heatmapMarkersRef.current = newMarkers;
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(newMarkers);
  }, [map, points]);

  // Fit to data on first load.
  useEffect(() => {
    if (!map || hasFitted.current || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) bounds.extend({ lat: p.lat, lng: p.lon });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 32);
      hasFitted.current = true;
    }
  }, [map, points]);

  // Selection radius + fly-to.
  useEffect(() => {
    if (!map) return;
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
    if (!selectedPoint) return;

    circleRef.current = new google.maps.Circle({
      map,
      center: { lat: selectedPoint.lat, lng: selectedPoint.lon },
      radius: RADIUS_M,
      strokeColor: "#f97316",
      strokeWeight: 2,
      fillColor: "#f97316",
      fillOpacity: 0.12,
    });

    const currentZoom = map.getZoom() ?? 11;
    map.panTo({ lat: selectedPoint.lat, lng: selectedPoint.lon });
    if (currentZoom < 13) map.setZoom(13);
  }, [map, selectedPoint]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      for (const m of heatmapMarkersRef.current) m.setMap(null);
      heatmapMarkersRef.current = [];
      circleRef.current?.setMap(null);
      circleRef.current = null;
    };
  }, []);

  return null;
}

// ─── Missing-key panel ──────────────────────────────────────────────────────

function ConfigurePanel() {
  return (
    <div className="h-[320px] w-full rounded-xl border border-amber-300 bg-amber-50 p-6 flex flex-col items-center justify-center text-center gap-2">
      <div className="text-amber-700 font-semibold text-sm">
        Google Maps API key is not configured
      </div>
      <div className="text-amber-800 text-xs max-w-sm">
        Set{" "}
        <code className="font-mono bg-amber-100 px-1 rounded">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </code>{" "}
        in{" "}
        <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code>{" "}
        to enable the announcement heatmap.
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function AnnouncementLocationMap({
  points,
  selectedKey,
  onSelect,
}: Props) {
  const selectedPoint = useMemo(
    () => points.find((p) => p.key === selectedKey) ?? null,
    [points, selectedKey],
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return <ConfigurePanel />;
  }

  return (
    <div className="h-[320px] w-full rounded-xl border border-gray-200 overflow-hidden">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
          defaultZoom={11}
          gestureHandling="greedy"
          mapId="echo-admin-announcements"
          style={{ width: "100%", height: "100%" }}
        >
          {points.map((p) => (
            <AdvancedMarker
              key={p.key}
              position={{ lat: p.lat, lng: p.lon }}
              onClick={() => onSelect(p.key)}
              title={p.name}
            >
              <div
                className={
                  p.key === selectedKey
                    ? "h-4 w-4 rounded-full border-2 border-gray-900 bg-orange-500 shadow"
                    : "h-3 w-3 rounded-full border border-gray-800 bg-red-500"
                }
              />
            </AdvancedMarker>
          ))}
          <HeatmapAndSelection points={points} selectedPoint={selectedPoint} />
        </Map>
      </APIProvider>
    </div>
  );
}
