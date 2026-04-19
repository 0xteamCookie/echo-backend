import type { RequestHandler } from "express";

export type UserType = "official" | "user" | "agents";

declare global {
  // eslint-disable-next-line no-var
  namespace Express {
    interface Request {
      user?: {
        type: UserType;
        /** Stable user id for Firestore `users/{id}` (e.g. Firebase Auth uid); override with `x-user-id`. */
        id: string;
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
  const raw = String(req.header("x-user-type") ?? "").toLowerCase();
  const type: UserType = raw === "official" ? "official" : "user";
  const idRaw = String(req.header("x-user-id") ?? "demo").trim();
  req.user = { type, id: idRaw || "demo" };
  next();
};

export type Permission = "data:write" | "data:read";

export function requirePermission(_permission: Permission): RequestHandler {
  return (_req, _res, next) => {
    // TODO: enforce based on req.user.type. For now allow all.
    next();
  };
}

