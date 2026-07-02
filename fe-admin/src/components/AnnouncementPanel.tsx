"use client";

import React, { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { BellRing, MapPin, RefreshCcw, Send } from "lucide-react";
import { useAuth } from "../lib/auth/provider";
import { apiUrl } from "../lib/api";
import { ANNOUNCEMENT_LANGUAGES } from "../lib/languages";
import AnnouncementLocationMap from "./AnnouncementLocationMap";

type HeatmapPoint = {
  id: string;
  lat: number;
  lon: number;
  locationName?: string;
  weight?: number;
  receivedAt?: string;
};

type Announcement = {
  id: string;
  message: string;
  locationName: string;
  gps: { lat: number; lon: number };
  createdAt: string;
  createdBy?: string;
};

type NearbyPayload = {
  radiusM: number;
  announcements: Announcement[];
  fetchedAt: string;
  error?: string;
};

type HeatmapPayload = {
  points?: HeatmapPoint[];
  error?: string;
};

type LocationOption = {
  key: string;
  name: string;
  lat: number;
  lon: number;
  recency: string;
  weight?: number;
};

export default function AnnouncementPanel() {
  const { authHeader } = useAuth();
  const authValue = authHeader.Authorization ?? "";
  const [message, setMessage] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [lang, setLang] = useState("");
  const [submitState, setSubmitState] = useState<{
    pending: boolean;
    error: string;
    success: string;
  }>({
    pending: false,
    error: "",
    success: "",
  });

  const heatmapKey = authValue
    ? ([apiUrl("/api/data/heatmap?limit=300"), authValue] as const)
    : null;
  const {
    data: heatmapData,
    error: heatmapError,
    isLoading: heatmapLoading,
    mutate: refreshHeatmap,
  } = useSWR<HeatmapPayload>(
    heatmapKey,
    async ([url, authorization]: readonly [string, string]) => {
      const res = await fetch(url, {
        headers: { Authorization: authorization },
      });
      const data = (await res.json()) as HeatmapPayload;
      if (!res.ok)
        throw new Error(data.error ?? "Failed to load heatmap points");
      return data;
    },
    { refreshInterval: 15000, revalidateOnFocus: false },
  );

  const locations = useMemo<LocationOption[]>(() => {
    const points = Array.isArray(heatmapData?.points) ? heatmapData.points : [];
    const byKey = new Map<string, LocationOption>();
    for (const point of points) {
      if (typeof point.lat !== "number" || typeof point.lon !== "number")
        continue;
      const nameRaw =
        typeof point.locationName === "string" ? point.locationName.trim() : "";
      const name =
        nameRaw || `Point (${point.lat.toFixed(4)}, ${point.lon.toFixed(4)})`;
      const key = `${name}::${point.lat.toFixed(6)}::${point.lon.toFixed(6)}`;
      const existing = byKey.get(key);
      const recency = point.receivedAt ?? "";
      if (!existing || recency > existing.recency) {
        byKey.set(key, {
          key,
          name,
          lat: point.lat,
          lon: point.lon,
          recency,
          weight: point.weight,
        });
      }
    }
    return [...byKey.values()].sort((a, b) => (a.recency < b.recency ? 1 : -1));
  }, [heatmapData]);

  const selectedLocation =
    locations.find((item) => item.key === selectedKey) ?? null;
  const handleSelectLocation = useCallback((key: string) => {
    setSelectedKey(key);
    setSubmitState((prev) => ({ ...prev, error: "", success: "" }));
  }, []);

  const nearbyKey =
    authValue && selectedLocation
      ? ([
          apiUrl(
            `/api/announcement?lat=${selectedLocation.lat}&long=${selectedLocation.lon}&limit=50${
              lang ? `&lang=${encodeURIComponent(lang)}` : ""
            }`,
          ),
          authValue,
        ] as const)
      : null;
  const {
    data: nearbyData,
    error: nearbyError,
    isLoading: nearbyLoading,
    mutate: refreshNearby,
  } = useSWR<NearbyPayload>(
    nearbyKey,
    async ([url, authorization]: readonly [string, string]) => {
      const res = await fetch(url, {
        headers: { Authorization: authorization },
      });
      const data = (await res.json()) as NearbyPayload;
      if (!res.ok)
        throw new Error(data.error ?? "Failed to load nearby announcements");
      return data;
    },
    { refreshInterval: 12000, revalidateOnFocus: false },
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState({ pending: true, error: "", success: "" });

    if (!selectedLocation) {
      setSubmitState({
        pending: false,
        error: "Please choose a location from heatmap data.",
        success: "",
      });
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      setSubmitState({
        pending: false,
        error: "Please enter an announcement message.",
        success: "",
      });
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/announcement"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          message: trimmed,
          locationName: selectedLocation.name,
          gps: { lat: selectedLocation.lat, lon: selectedLocation.lon },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create announcement");
      }
      setMessage("");
      setSubmitState({
        pending: false,
        error: "",
        success: "Announcement sent successfully.",
      });
      await refreshNearby();
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unexpected error";
      setSubmitState({ pending: false, error: reason, success: "" });
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      <section className="col-span-12 lg:col-span-5 rounded-2xl border border-border bg-surface p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-ink flex items-center gap-2">
            <BellRing size={17} className="text-brand" />
            Publish Announcement
          </h3>
          <button
            type="button"
            onClick={() => void refreshHeatmap()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-elevated"
          >
            <RefreshCcw size={14} />
            Refresh locations
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-medium text-muted">
              Select location from heatmap
            </p>
            <AnnouncementLocationMap
              points={locations}
              selectedKey={selectedKey}
              onSelect={handleSelectLocation}
            />
            <p className="text-[11px] text-muted">
              Click a map point to choose location. The orange circle shows the
              1km announcement radius.
            </p>
          </div>

          {selectedLocation && (
            <div className="rounded-lg border border-border bg-elevated p-2.5 text-[12px] text-muted flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-muted" />
                {selectedLocation.name}
              </span>
              <span className="text-muted">
                {selectedLocation.lat.toFixed(5)},{" "}
                {selectedLocation.lon.toFixed(5)}
              </span>
            </div>
          )}

          <label className="text-[12px] font-medium text-muted">
            Message
            <textarea
              className="mt-1 h-32 w-full resize-none rounded-lg border border-border bg-elevated text-ink px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="Type public safety announcement..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSubmitState((prev) => ({ ...prev, error: "", success: "" }));
              }}
              maxLength={500}
            />
          </label>

          {heatmapError && (
            <p className="text-[12px] text-danger">{heatmapError.message}</p>
          )}
          {submitState.error && (
            <p className="text-[12px] text-danger">{submitState.error}</p>
          )}
          {submitState.success && (
            <p className="text-[12px] text-success">
              {submitState.success}
            </p>
          )}

          <button
            type="submit"
            disabled={
              submitState.pending || !selectedLocation || message.trim() === ""
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-white px-4 py-2 text-[13px] font-semibold hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={14} />
            {submitState.pending ? "Publishing..." : "Publish announcement"}
          </button>
        </form>
        {heatmapLoading && (
          <p className="text-[12px] text-muted">
            Loading heatmap points for location selection...
          </p>
        )}
      </section>

      <section className="col-span-12 lg:col-span-7 rounded-2xl border border-border bg-surface p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-ink">
            Nearby Announcements
          </h3>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="announcement-lang">
              Translate announcements
            </label>
            <select
              id="announcement-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              title="Translate announcements (Google Cloud Translation)"
              className="rounded-full border border-border bg-elevated px-3 py-1.5 text-[12px] font-medium text-ink outline-none focus:ring-2 focus:ring-brand/30"
            >
              {ANNOUNCEMENT_LANGUAGES.map((l) => (
                <option key={l.code || "original"} value={l.code}>
                  {l.code ? `🌐 ${l.label}` : l.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void refreshNearby()}
              disabled={!selectedLocation}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {!selectedLocation && (
          <div className="rounded-xl border border-border bg-elevated p-3 text-[13px] text-muted">
            Select a heatmap location to view announcements within 1km.
          </div>
        )}

        {selectedLocation && nearbyLoading && (
          <div className="rounded-xl border border-border bg-elevated p-3 text-[13px] text-muted">
            Loading nearby announcements...
          </div>
        )}

        {selectedLocation && nearbyError && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">
            {nearbyError.message}
          </div>
        )}

        {selectedLocation &&
          !nearbyLoading &&
          !nearbyError &&
          (nearbyData?.announcements.length ?? 0) === 0 && (
            <div className="rounded-xl border border-border bg-elevated p-3 text-[13px] text-muted">
              No announcements found in the selected 1km radius.
            </div>
          )}

        {selectedLocation &&
          !nearbyLoading &&
          !nearbyError &&
          (nearbyData?.announcements.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              {nearbyData!.announcements.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-ink">
                      {item.locationName}
                    </p>
                    <p className="text-[11px] text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-[13px] text-muted mt-2">
                    {item.message}
                  </p>
                  {lang && (
                    <p className="text-[10px] text-brand mt-1.5 uppercase tracking-wide">
                      🌐 Translated · {lang}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
      </section>
    </div>
  );
}
