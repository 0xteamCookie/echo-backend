import type { RequestHandler } from "express";
import type { IssueTokenBody } from "./provision.schema";
import { provisionService } from "./provision.service";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseRole(value: unknown): "super_admin" | "medical" | "fire" | "police" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "super_admin" ||
    normalized === "super-admin" ||
    normalized === "admin" ||
    normalized === "medical" ||
    normalized === "fire" ||
    normalized === "police"
  ) {
    if (normalized === "super-admin" || normalized === "admin") return "super_admin";
    return normalized;
  }
  return null;
}

function parseAgency(value: unknown): "medical" | "fire" | "police" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "medical" || normalized === "fire" || normalized === "police") {
    return normalized;
  }
  return null;
}

export const provisionController = {
  issueToken: (async (req, res) => {
    const body = req.body;
    if (!isRecord(body)) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    const sub = body.sub;
    const role = parseRole(body.role);
    const agency = parseAgency(body.agency);
    if (typeof sub !== "string" || !sub.trim()) {
      res.status(400).json({ error: "sub is required and must be a non-empty string" });
      return;
    }
    if (!role) {
      res.status(400).json({ error: "role must be one of super_admin, medical, fire, police" });
      return;
    }
    if (!agency) {
      res.status(400).json({ error: "agency must be one of medical, fire, police" });
      return;
    }
    if (role !== "super_admin" && role !== agency) {
      res.status(400).json({ error: "agency-scoped users must have matching role and agency" });
      return;
    }
    if (typeof body.name !== "string" || !body.name.trim()) {
      res.status(400).json({ error: "name is required and must be a non-empty string (agent name)" });
      return;
    }

    const radius_m = parseFiniteNumber(body.radius_m);
    if (radius_m === null || radius_m <= 0) {
      res.status(400).json({ error: "radius_m must be a positive number (metres)" });
      return;
    }

    const lat = parseFiniteNumber(body.lat);
    if (lat === null || lat < -90 || lat > 90) {
      res.status(400).json({ error: "lat must be a number between -90 and 90" });
      return;
    }

    const lngRaw = body.lng !== undefined ? body.lng : body.long;
    const lng = parseFiniteNumber(lngRaw);
    if (lng === null || lng < -180 || lng > 180) {
      res.status(400).json({ error: "lng (or long) must be a number between -180 and 180" });
      return;
    }

    const patch: IssueTokenBody = {
      sub: sub.trim(),
      role,
      agency,
      name: body.name.trim(),
      radius_m,
      lat,
      lng,
    };

    if (body.expiresInSeconds !== undefined) {
      if (typeof body.expiresInSeconds !== "number" || !Number.isFinite(body.expiresInSeconds)) {
        res.status(400).json({ error: "expiresInSeconds must be a finite number" });
        return;
      }
      patch.expiresInSeconds = body.expiresInSeconds;
    }

    try {
      const result = await provisionService.issueToken(patch);
      res.json({
        token: result.token,
        expiresInSeconds: result.expiresInSeconds,
        tokenType: "Bearer",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to issue token";
      if (message.includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
        res.status(503).json({ error: "JWT provisioning is not configured (FIREBASE_SERVICE_ACCOUNT_JSON missing or invalid)" });
        return;
      }
      throw e;
    }
  }) satisfies RequestHandler,
};
