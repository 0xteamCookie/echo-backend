/// <reference types="@types/google.maps" />
"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import {
  MarkerClusterer,
  SuperClusterAlgorithm,
} from "@googlemaps/markerclusterer";
import type { DeviceEntry } from "../../hooks/useRealtimeEvents";
import { isResolvedStatus, type ClickableEntry, type HeatPoint } from "./types";

// ─── Heatmap overlay (using marker clustering) ──────────────────────────────

export function HeatmapOverlay({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    // Initialize clusterer if not exists
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        algorithm: new SuperClusterAlgorithm({ radius: 100 }),
        renderer: {
          render: ({ count, position }) => {
            const color = count > 50 ? "#C84D3A" : count > 20 ? "#D9A441" : "#4E8F6A";
            const size = Math.min(50, 25 + Math.log(count) * 3);
            return new google.maps.Marker({
              position,
              label: {
                text: String(count),
                color: "#fff",
                fontSize: "12px",
                fontWeight: "bold",
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: size / 2,
                fillColor: color,
                fillOpacity: 0.8,
                strokeColor: "#fff",
                strokeWeight: 2,
              },
            });
          },
        },
      });
    }

    // Create markers from heatmap points
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const newMarkers = points.map(
      (p) =>
        new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          title: `Weight: ${p.weight.toFixed(1)}`,
          opacity: Math.min(1, 0.3 + p.weight / 10),
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: Math.max(2, p.weight / 3),
            fillColor: "#6A8FB3",
            fillOpacity: 0.6,
            strokeColor: "#3f5d77",
            strokeWeight: 1,
          },
        }),
    );

    markersRef.current = newMarkers;
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(newMarkers);
  }, [map, points]);

  useEffect(() => {
    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
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
          fillColor: resolved ? "#4E8F6A" : "#D96B3D",
          fillOpacity: resolved ? 0.9 : 0.85,
          strokeColor: assigned ? "#0b0e14" : "#ffffff",
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
