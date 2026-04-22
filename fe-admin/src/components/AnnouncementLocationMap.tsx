"use client";

import React, { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";

type HeatLayerFactory = typeof L & {
  heatLayer: (latlngs: Array<[number, number, number]>, options?: Record<string, unknown>) => L.Layer;
};

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

export default function AnnouncementLocationMap({ points, selectedKey, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const heatLayer = useRef<L.Layer | null>(null);
  const pointLayer = useRef<L.LayerGroup | null>(null);
  const selectionLayer = useRef<L.LayerGroup | null>(null);
  const hasFittedToData = useRef(false);

  const selectedPoint = useMemo(
    () => points.find((point) => point.key === selectedKey) ?? null,
    [points, selectedKey],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    if (!mapInstance.current) {
      const map = L.map(mapRef.current, { zoomControl: true }).setView([37.7749, -122.4194], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "(C) OpenStreetMap",
      }).addTo(map);
      mapInstance.current = map;
      pointLayer.current = L.layerGroup().addTo(map);
      selectionLayer.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      heatLayer.current = null;
      pointLayer.current = null;
      selectionLayer.current = null;
      hasFittedToData.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !pointLayer.current) return;

    if (heatLayer.current) {
      mapInstance.current.removeLayer(heatLayer.current);
      heatLayer.current = null;
    }
    pointLayer.current.clearLayers();

    if (points.length === 0) return;

    const latlngs = points.map((point) => [
      point.lat,
      point.lon,
      Math.max(0.15, ((point.weight ?? 1) as number) / 8),
    ]) as Array<[number, number, number]>;
    heatLayer.current = (L as HeatLayerFactory)
      .heatLayer(latlngs, { radius: 28, blur: 22, maxZoom: 14 })
      .addTo(mapInstance.current);

    for (const point of points) {
      const marker = L.circleMarker([point.lat, point.lon], {
        radius: 6,
        color: "#1f2937",
        weight: 1,
        fillColor: "#ef4444",
        fillOpacity: 0.85,
      });
      marker.bindTooltip(point.name, { direction: "top", offset: [0, -6] });
      marker.on("click", () => onSelect(point.key));
      pointLayer.current.addLayer(marker);
    }

    if (!hasFittedToData.current) {
      const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lon] as [number, number]));
      if (bounds.isValid()) {
        mapInstance.current.fitBounds(bounds.pad(0.2));
      }
      hasFittedToData.current = true;
    }
  }, [onSelect, points]);

  useEffect(() => {
    if (!mapInstance.current || !selectionLayer.current) return;
    selectionLayer.current.clearLayers();
    if (!selectedPoint) return;

    const center: L.LatLngExpression = [selectedPoint.lat, selectedPoint.lon];
    const focus = L.circleMarker(center, {
      radius: 8,
      color: "#111827",
      weight: 2,
      fillColor: "#f97316",
      fillOpacity: 1,
    });
    focus.bindTooltip(`${selectedPoint.name} (selected)`, { direction: "top", offset: [0, -8] });
    selectionLayer.current.addLayer(focus);

    const radius = L.circle(center, {
      radius: RADIUS_M,
      color: "#f97316",
      weight: 2,
      fillColor: "#f97316",
      fillOpacity: 0.12,
    });
    selectionLayer.current.addLayer(radius);

    const currentZoom = mapInstance.current.getZoom();
    mapInstance.current.flyTo(center, Math.max(13, currentZoom), { duration: 0.4 });
  }, [selectedPoint]);

  return <div ref={mapRef} className="h-[320px] w-full rounded-xl border border-gray-200" />;
}
