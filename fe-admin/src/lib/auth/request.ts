import type { AuthSession } from "./types";

export function authHeaders(session: AuthSession): Record<string, string> {
  return {
    "x-user-id": session.userId,
    "x-user-role": session.role,
    "x-user-agencies": session.agencies.join(","),
  };
}
