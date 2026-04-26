import type { Agency, AuthSession, Permission, Role } from "./types";

export function can(session: AuthSession, permission: Permission): boolean {
  if (!session.authenticated) return false;
  if (session.role === "super_admin") return true;
  switch (permission) {
    case "data:read":
    case "data:write":
      return true;
    case "provision:issue":
    case "settings:read":
      return false;
    default:
      return false;
  }
}

export function roleDefaultAgencies(role: Role): Agency[] {
  if (role === "super_admin") return ["medical", "fire", "police"];
  return [role];
}

export function hasAgencyAccess(session: AuthSession, agency: Agency): boolean {
  if (!session.authenticated) return false;
  if (session.role === "super_admin") return session.agencies.includes(agency);
  return session.role === agency || session.agencies.includes(agency);
}

export function canAccessPath(session: AuthSession, pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (!session.authenticated) return false;
  if (pathname.startsWith("/provision")) return can(session, "provision:issue");
  if (pathname.startsWith("/settings")) return can(session, "settings:read");
  if (pathname.startsWith("/medical"))
    return hasAgencyAccess(session, "medical");
  if (pathname.startsWith("/fire-rescue"))
    return hasAgencyAccess(session, "fire");
  if (pathname.startsWith("/police")) return hasAgencyAccess(session, "police");
  return can(session, "data:read");
}
