import crypto from "node:crypto";
import type { CreateDeviceDataBody, DeviceData } from "./data.schema";

const store: DeviceData[] = [];

function normalizeMac(input: string): string {
  return input.trim().toLowerCase();
}

export const dataService = {
  create(payload: CreateDeviceDataBody): DeviceData {
    const now = new Date().toISOString();
    const record: DeviceData = {
      id: crypto.randomUUID(),
      macAddress: normalizeMac(payload.macAddress),
      message: payload.message,
      time: payload.time,
      gps: payload.gps,
      meta: payload.meta,
      receivedAt: now,
    };
    store.push(record);
    return record;
  },

  list(filter?: { macAddress?: string; limit?: number }): DeviceData[] {
    const mac = filter?.macAddress ? normalizeMac(filter.macAddress) : undefined;
    let items = mac ? store.filter((x) => x.macAddress === mac) : store;
    items = [...items].reverse(); // newest first
    const limit = typeof filter?.limit === "number" ? filter.limit : 100;
    return items.slice(0, Math.max(0, Math.min(1000, limit)));
  },
};

