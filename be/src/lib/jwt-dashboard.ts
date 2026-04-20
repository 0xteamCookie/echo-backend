import crypto from "node:crypto";
import { config } from "./config";

const ALG = "HS256" as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let josePromise: Promise<any> | null = null;
function loadJose(): Promise<any> {
  if (!josePromise) josePromise = import("jose");
  return josePromise;
}

export type DashboardJwtClaims = {
  sub: string;
  email: string;
  role: "super_admin" | "medical" | "fire" | "police";
  agencies: Array<"medical" | "fire" | "police">;
};

function dashboardSecret(): Uint8Array {
  const secret = config.dashboardJwtSecret.trim();
  if (!secret) {
    throw new Error("DASHBOARD_JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signDashboardJwt(claims: DashboardJwtClaims): Promise<string> {
  const { SignJWT } = await loadJose();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: claims.email,
    role: claims.role,
    agencies: claims.agencies,
  })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setIssuer(config.jwtIssuer)
    .setAudience("echo-admin")
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 12)
    .setJti(crypto.randomUUID())
    .sign(dashboardSecret());
}

export async function verifyDashboardJwt(token: string): Promise<DashboardJwtClaims> {
  const { jwtVerify } = await loadJose();
  const { payload } = await jwtVerify(token, dashboardSecret(), {
    issuer: config.jwtIssuer,
    audience: "echo-admin",
    algorithms: [ALG],
  });

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Invalid admin token");
  }
  if (typeof payload.email !== "string" || !payload.email) {
    throw new Error("Invalid admin token");
  }
  const role = payload.role;
  if (role !== "super_admin" && role !== "medical" && role !== "fire" && role !== "police") {
    throw new Error("Invalid admin token");
  }
  const agenciesRaw = payload.agencies;
  const agencies = Array.isArray(agenciesRaw)
    ? agenciesRaw.filter(
        (a): a is "medical" | "fire" | "police" =>
          a === "medical" || a === "fire" || a === "police",
      )
    : [];
  return {
    sub: payload.sub,
    email: payload.email,
    role,
    agencies,
  };
}
