export type Agency = "medical" | "fire" | "police";
export type Role = "super_admin" | Agency;

export type Permission =
  | "data:read"
  | "data:write"
  | "provision:issue"
  | "settings:read";

export type AuthSession = {
  authenticated: boolean;
  userId: string;
  email?: string;
  role: Role;
  agencies: Agency[];
};

export const ALL_AGENCIES: Agency[] = ["medical", "fire", "police"];

export function defaultSession(): AuthSession {
  return {
    authenticated: false,
    userId: "",
    email: "",
    role: "medical",
    agencies: [],
  };
}
