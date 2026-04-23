import type { RequestHandler } from "express";
import { verifyDashboardJwt } from "../lib/jwt-dashboard";
import { config } from "../lib/config";

export type UserType = "official" | "user" | "agents" | "ingest";
export type Agency = "medical" | "fire" | "police";
export type UserRole = "super_admin" | Agency;

const ALL_AGENCIES: Agency[] = ["medical", "fire", "police"];

declare global {
  // eslint-disable-next-line no-var
  namespace Express {
    interface Request {
      user?: {
        type: UserType;
        /** Stable user id for Firestore `users/{id}` (e.g. Firebase Auth uid). */
        id: string;
        email?: string;
        role: UserRole;
        agencies: Agency[];
      };
    }
  }
}

/**
 * Authenticates the caller via `Authorization: Bearer <jwt>` against the
 * dashboard HS256 secret. Legacy `x-user-*` header-trust fallback was removed
 * in P0-6; if no valid token is present, `req.user` is left undefined and
 * route-level `requirePermission` / `requireIngestAuth` will 401.
 */
export const identifyUser: RequestHandler = (req, _res, next) => {
  const run = async () => {
    const auth = String(req.header("authorization") ?? "").trim();
    const match = /^Bearer\s+(\S+)$/i.exec(auth);
    if (!match?.[1]) {
      req.user = undefined;
      next();
      return;
    }

    // If the bearer is the shared ingest token, mark the caller as a low-trust
    // mobile ingestor (no dashboard permissions). Constant-time compare.
    const ingest = config.ingestToken;
    if (ingest && safeEqual(match[1], ingest)) {
      req.user = {
        type: "ingest",
        id: "mobile-ingest",
        role: "medical",
        agencies: [],
      };
      next();
      return;
    }

    try {
      const payload = await verifyDashboardJwt(match[1]);
      req.user = {
        type: "official",
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        agencies:
          payload.role === "super_admin"
            ? [...ALL_AGENCIES]
            : payload.agencies.length > 0
              ? payload.agencies
              : [payload.role],
      };
    } catch {
      req.user = undefined;
    }
    next();
  };

  void run();
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export type Permission = "data:write" | "data:read" | "provision:issue";

function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === "super_admin") return true;
  switch (permission) {
    case "data:read":
    case "data:write":
      return true;
    case "provision:issue":
      return false;
    default:
      return false;
  }
}

export function getAllowedAgencies(req: Express.Request): Agency[] {
  if (!req.user) return [];
  if (req.user.role === "super_admin") return [...ALL_AGENCIES];
  return req.user.agencies.length > 0 ? req.user.agencies : [req.user.role];
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    // Mobile ingest tokens can only hit ingest routes (guarded separately).
    if (req.user.type === "ingest" && permission !== "data:write") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * Accepts either a dashboard JWT with `data:write`, or the shared ingest
 * bearer token (mobile devices). Returns 401 otherwise.
 */
export const requireIngestAuth: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  if (req.user.type === "ingest") {
    next();
    return;
  }
  if (hasPermission(req.user.role, "data:write")) {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden" });
};

