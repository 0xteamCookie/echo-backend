import type { RequestHandler } from "express";
import { verifyDashboardJwt } from "../lib/jwt-dashboard";

export type UserType = "official" | "user" | "agents";
export type Agency = "medical" | "fire" | "police";
export type UserRole = "super_admin" | Agency;

const ALL_AGENCIES: Agency[] = ["medical", "fire", "police"];

function parseAgency(value: string): Agency | null {
  switch (value.trim().toLowerCase()) {
    case "medical":
      return "medical";
    case "fire":
      return "fire";
    case "police":
      return "police";
    default:
      return null;
  }
}

function parseRole(value: string): UserRole {
  const normalized = value.trim().toLowerCase();
  if (normalized === "super_admin" || normalized === "super-admin" || normalized === "admin") {
    return "super_admin";
  }
  const agency = parseAgency(normalized);
  if (agency) return agency;
  return "medical";
}

function parseAgencies(value: string): Agency[] {
  const unique = new Set<Agency>();
  for (const token of value.split(",")) {
    const agency = parseAgency(token);
    if (agency) unique.add(agency);
  }
  return [...unique];
}

declare global {
  // eslint-disable-next-line no-var
  namespace Express {
    interface Request {
      user?: {
        type: UserType;
        /** Stable user id for Firestore `users/{id}` (e.g. Firebase Auth uid); override with `x-user-id`. */
        id: string;
        email?: string;
        role: UserRole;
        agencies: Agency[];
      };
    }
  }
}

/**
 * For now this accepts everyone. Later you can enforce auth
 * and role-based permissions here.
 *
 * Client can optionally send `x-user-type: official|user`.
 */
export const identifyUser: RequestHandler = (req, _res, next) => {
  const run = async () => {
    const auth = String(req.header("authorization") ?? "").trim();
    const match = /^Bearer\s+(\S+)$/i.exec(auth);
    if (match?.[1]) {
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
        next();
        return;
      } catch {
        // fall through to legacy header mode
      }
    }

    const raw = String(req.header("x-user-type") ?? "").toLowerCase();
    const type: UserType = raw === "official" ? "official" : "user";
    const idRaw = String(req.header("x-user-id") ?? "").trim();
    const roleHeader = String(req.header("x-user-role") ?? "").trim();
    if (!idRaw || !roleHeader) {
      req.user = undefined;
      next();
      return;
    }

    const role = parseRole(roleHeader);
    const agenciesHeader = String(req.header("x-user-agencies") ?? "");
    const agencies = parseAgencies(agenciesHeader);
    const effectiveAgencies =
      role === "super_admin" ? [...ALL_AGENCIES] : agencies.length > 0 ? agencies : [role];
    req.user = { type, id: idRaw, role, agencies: effectiveAgencies };
    next();
  };

  void run();
};

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
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

