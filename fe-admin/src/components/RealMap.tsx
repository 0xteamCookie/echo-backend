"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../lib/auth/provider";

type HeatPoint = { lat: number; lon: number; weight?: number };
type HeatLayerFactory = typeof L & {
  heatLayer: (latlngs: Array<[number, number, number]>, options?: Record<string, unknown>) => L.Layer;
};

export default function RealMap() {
  const { authHeader } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const heatLayer = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([37.7749, -122.4194], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(mapInstance.current);
    }

    let isPolling = true;

    async function fetchHeatmap() {
      try {
        const res = await fetch("/api/data/heatmap?limit=200", {
          headers: authHeader,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { points?: HeatPoint[] };
        
        if (data.points && Array.isArray(data.points) && mapInstance.current) {
           if (heatLayer.current) {
              mapInstance.current.removeLayer(heatLayer.current);
           }
           const latlngs = data.points.map((p) => [p.lat, p.lon, Math.max(0.15, (p.weight || 1) / 8)] as [number, number, number]);
           heatLayer.current = (L as HeatLayerFactory)
             .heatLayer(latlngs, { radius: 28, blur: 22, maxZoom: 14 })
             .addTo(mapInstance.current);
        }
      } catch (e) {
        console.error("Heatmap fetch error", e);
      }
    }

    fetchHeatmap();
    const interval = setInterval(() => {
      if (isPolling) fetchHeatmap();
    }, 4000);

    return () => {
      isPolling = false;
      clearInterval(interval);
      if (mapInstance.current) {
         mapInstance.current.remove();
         mapInstance.current = null;
      }
    };
  }, [authHeader]);

  return <div ref={mapRef} className="w-full h-full rounded-xl z-0" />;
}

