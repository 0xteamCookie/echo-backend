import { createPrivateKey, createPublicKey, randomUUID } from "node:crypto";

/** JWK shape returned for `/.well-known/jwks.json` (avoids type imports from ESM `jose` in CJS). */
export type ProvisioningJwk = Record<string, unknown> & {
  kid?: string;
  kty?: string;
  use?: string;
  alg?: string;
};

/** Payload after verifying a rescuer JWT. */
export type VerifiedRescuerPayload = {
  sub: string;
  jti?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  /** Role slug (e.g. medic, fire). */
  role?: string;
  /** Agency scope. */
  agency?: "medical" | "fire" | "police";
  /** Display name of the agent. */
  name?: string;
  /** Authorized radius in metres. */
  radius_m?: number;
  /** Latitude (WGS84). */
  lat?: number;
  /** Longitude (WGS84). */
  lng?: number;
  [claim: string]: unknown;
};

const ALG = "RS256" as const;

// Default issuer/audience — can be overridden by env vars if needed.
const ISSUER = process.env.JWT_ISSUER?.trim() || "echo";
const AUDIENCE = process.env.JWT_AUDIENCE?.trim() || "echo-rescuer";

/** `jose` is ESM-only; load it dynamically so CommonJS `tsc` output still runs in Node. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoid `import("jose")` type refs in CJS project
let josePromise: Promise<any> | null = null;
function loadJose(): Promise<any> {
  if (!josePromise) josePromise = import("jose");
  return josePromise;
}

/** Extract the RSA private key PEM + key-id from FIREBASE_SERVICE_ACCOUNT_JSON. */
function getServiceAccountKey(): { pem: string; kid: string } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set — cannot derive JWT signing key",
    );
  }
  let sa: { private_key?: string; private_key_id?: string };
  try {
    sa = JSON.parse(raw) as { private_key?: string; private_key_id?: string };
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!sa.private_key || !sa.private_key.includes("BEGIN")) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON does not contain a valid private_key",
    );
  }
  // Firebase stores the key with literal \n — normalize to real newlines.
  const pem = sa.private_key.replace(/\\n/g, "\n").trim();
  const kid = sa.private_key_id ?? "firebase-sa-key";
  return { pem, kid };
}

let cachedPrivateKey: CryptoKey | null = null;
let cachedPublicJwk: ProvisioningJwk | null = null;

export async function getProvisioningPrivateKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const { importPKCS8 } = await loadJose();
  const { pem } = getServiceAccountKey();
  const key = await importPKCS8(pem, ALG);
  cachedPrivateKey = key;
  return key;
}

/** Public JWK for JWKS — derived from the Firebase SA key (safe to expose). */
export async function getProvisioningPublicJwk(): Promise<ProvisioningJwk> {
  if (cachedPublicJwk) return cachedPublicJwk;
  const { exportJWK } = await loadJose();
  const { pem, kid } = getServiceAccountKey();
  const priv = createPrivateKey({ key: pem, format: "pem" });
  const pub = createPublicKey(priv);
  const jwk = (await exportJWK(pub)) as ProvisioningJwk;
  jwk.kid = kid;
  jwk.use = "sig";
  jwk.alg = ALG;
  cachedPublicJwk = jwk;
  return jwk;
}

export type RescuerJwtClaims = {
  sub: string;
  role: "super_admin" | "medical" | "fire" | "police";
  agency: "medical" | "fire" | "police";
  name: string;
  radius_m: number;
  lat: number;
  lng: number;
};

export async function signRescuerJwt(
  claims: RescuerJwtClaims,
  expiresInSeconds: number,
): Promise<string> {
  const { SignJWT } = await loadJose();
  const { kid } = getServiceAccountKey();
  const privateKey = await getProvisioningPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    role: claims.role,
    agency: claims.agency,
    name: claims.name,
    radius_m: claims.radius_m,
    lat: claims.lat,
    lng: claims.lng,
  })
    .setProtectedHeader({ alg: ALG, kid, typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .setJti(randomUUID())
    .sign(privateKey);

  return token;
}

/** Verify a rescuer JWT (same rules as a rescuer app with the public key). */
export async function verifyRescuerJwt(
  token: string,
): Promise<VerifiedRescuerPayload> {
  const { importJWK, jwtVerify } = await loadJose();
  const publicJwk = await getProvisioningPublicJwk();
  const key = await importJWK(publicJwk, ALG);
  const { payload } = await jwtVerify(token, key, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: [ALG],
  });
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Invalid token: missing sub");
  }
  return payload as VerifiedRescuerPayload;
}
