/// <reference types="@types/google.maps" />
"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { DeviceEntry } from "../../hooks/useRealtimeEvents";
import { isResolvedStatus, type ClickableEntry, type HeatPoint } from "./types";

// ─── Heatmap overlay ─────────────────────────────────────────────────────────

export function HeatmapOverlay({ points }: { points: HeatPoint[] }) {
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
    layerRef.current.setData(
      points.map((p) => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        weight: Math.max(0.15, p.weight / 8),
      })),
    );
  }, [map, visualization, points]);

  useEffect(() => {
    return () => {
      layerRef.current?.setMap(null);
      layerRef.current = null;
    };
  }, []);

  return null;
}

// ─── Incident markers (clickable) ────────────────────────────────────────────

export function IncidentMarkers({
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
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    for (const { entry, lat, lng } of items) {
      const assigned = Boolean(entry.assignment?.rescuerId);
      const resolved = isResolvedStatus(entry.status);
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: resolved ? "#16a34a" : "#E63946",
          fillOpacity: resolved ? 0.9 : 0.85,
          strokeColor: assigned ? "#111827" : "#ffffff",
          strokeWeight: assigned ? 2.5 : 1.5,
        },
        label: assigned
          ? { text: "A", color: "#fff", fontWeight: "700", fontSize: "10px" }
          : resolved
            ? { text: "✓", color: "#fff", fontWeight: "700", fontSize: "9px" }
            : undefined,
        title: resolved
          ? "Resolved"
          : entry.assignment?.rescuerName
            ? `Assigned: ${entry.assignment.rescuerName}`
            : "Unassigned incident",
        cursor: "pointer",
        clickable: true,
      });
      marker.addListener("click", () => {
        if (assigned && !resolved) return;
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

// ─── Auto-fit (centers on points after layout settles) ───────────────────────

export function AutoFitToPoints({
  points,
  padding = 80,
}: {
  points: HeatPoint[];
  padding?: number;
}) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (!map || hasFittedRef.current || points.length === 0) return;

    // Wait one frame so the map's container has its final size — without
    // this, fitBounds runs against a stale viewport and renders offset.
    const raf = requestAnimationFrame(() => {
      if (points.length === 1) {
        map.setCenter({ lat: points[0].lat, lng: points[0].lng });
        map.setZoom(15);
      } else {
        const bounds = new google.maps.LatLngBounds();
        for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
        map.fitBounds(bounds, padding);
      }
      hasFittedRef.current = true;
    });

    return () => cancelAnimationFrame(raf);
  }, [map, points, padding]);

  return null;
}

// ─── Imperative pan (used by sidebar clicks) ─────────────────────────────────

export function FocusPoint({
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
