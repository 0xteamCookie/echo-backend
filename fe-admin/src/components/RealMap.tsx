"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";

export default function RealMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const heatLayer = useRef<any>(null);

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
        const res = await fetch("http://localhost:3000/api/data/heatmap?limit=200");
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.points && Array.isArray(data.points) && mapInstance.current) {
           if (heatLayer.current) {
              mapInstance.current.removeLayer(heatLayer.current);
           }
           const latlngs = data.points.map((p: any) => [p.lat, p.lon, Math.max(0.15, (p.weight || 1) / 8)]);
           // @ts-ignore
           heatLayer.current = L.heatLayer(latlngs, { radius: 28, blur: 22, maxZoom: 14 }).addTo(mapInstance.current);
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
  }, []);

  return <div ref={mapRef} className="w-full h-full rounded-xl z-0" />;
}

