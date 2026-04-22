"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../lib/auth/provider";
import {
  useRealtimeEvents,
  FIRESTORE_NO_CLIENT,
  type DeviceEntry,
} from "../hooks/useRealtimeEvents";

type HeatLayerFactory = typeof L & {
  heatLayer: (
    latlngs: Array<[number, number, number]>,
    options?: Record<string, unknown>,
  ) => L.Layer;
};

const CATEGORY_WEIGHT: Record<string, number> = {
  medical: 1.0,
  fire: 1.5,
  police: 1.0,
  rescue: 1.2,
  broadcast: 0.8,
  unknown: 0.5,
};

function entryToHeatPoint(
  entry: DeviceEntry,
): [number, number, number] | null {
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
  const weight = severity * (CATEGORY_WEIGHT[cat] ?? CATEGORY_WEIGHT.unknown);
  return [entry.gps.lat, entry.gps.lon, Math.max(0.15, weight / 8)];
}

export default function RealMap() {
  const { authHeader } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);

  const { events, error } = useRealtimeEvents({ limit: 200 });

  // ── Initialize map (once on mount) ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView(
        [37.7749, -122.4194],
        11,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(mapInstance.current);
    }

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // ── Paint heatmap from onSnapshot events ───────────────────────────────
  useEffect(() => {
    if (!mapInstance.current || error === FIRESTORE_NO_CLIENT) return;

    if (heatLayerRef.current) {
      mapInstance.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const pts = events
      .map(entryToHeatPoint)
      .filter((p): p is [number, number, number] => p !== null);

    if (pts.length > 0) {
      heatLayerRef.current = (L as HeatLayerFactory)
        .heatLayer(pts, { radius: 28, blur: 22, maxZoom: 14 })
        .addTo(mapInstance.current);
    }
  }, [events, error]);

  // ── Fallback: poll REST when Firestore client SDK is not configured ─────
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
        if (data.points && Array.isArray(data.points) && mapInstance.current) {
          if (heatLayerRef.current) {
            mapInstance.current.removeLayer(heatLayerRef.current);
            heatLayerRef.current = null;
          }
          const pts = data.points.map(
            (p) =>
              [
                p.lat,
                p.lon,
                Math.max(0.15, (p.weight ?? 1) / 8),
              ] as [number, number, number],
          );
          if (pts.length > 0) {
            heatLayerRef.current = (L as HeatLayerFactory)
              .heatLayer(pts, { radius: 28, blur: 22, maxZoom: 14 })
              .addTo(mapInstance.current);
          }
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

  return <div ref={mapRef} className="w-full h-full rounded-xl z-0" />;
}

