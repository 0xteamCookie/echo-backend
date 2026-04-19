import { createPrivateKey, createPublicKey, randomUUID } from "node:crypto";
import { config } from "./config";

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
  role?: string;
  org?: string;
  name?: string;
  [claim: string]: unknown;
};

const ALG = "RS256" as const;

/** `jose` is ESM-only; load it dynamically so CommonJS `tsc` output still runs in Node. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoid `import("jose")` type refs in CJS project
let josePromise: Promise<any> | null = null;
function loadJose(): Promise<any> {
  if (!josePromise) josePromise = import("jose");
  return josePromise;
}

let cachedPrivateKey: CryptoKey | null = null;
let cachedPublicJwk: ProvisioningJwk | null = null;

function getPrivateKeyPem(): string {
  const pem = config.jwtPrivateKeyPem;
  if (!pem || !pem.includes("BEGIN")) {
    throw new Error("JWT_PRIVATE_KEY is not configured");
  }
  return pem;
}

export async function getProvisioningPrivateKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const { importPKCS8 } = await loadJose();
  const key = await importPKCS8(getPrivateKeyPem(), ALG);
  cachedPrivateKey = key;
  return key;
}

/** Public JWK for JWKS — derived from the same RSA key (safe to expose). */
export async function getProvisioningPublicJwk(): Promise<ProvisioningJwk> {
  if (cachedPublicJwk) return cachedPublicJwk;
  const { exportJWK } = await loadJose();
  const pem = getPrivateKeyPem();
  const priv = createPrivateKey({ key: pem, format: "pem" });
  const pub = createPublicKey(priv);
  const jwk = (await exportJWK(pub)) as ProvisioningJwk;
  jwk.kid = config.jwtKeyId;
  jwk.use = "sig";
  jwk.alg = ALG;
  cachedPublicJwk = jwk;
  return jwk;
}

export type RescuerJwtClaims = {
  sub: string;
  role: string;
  org?: string;
  name?: string;
};

export async function signRescuerJwt(
  claims: RescuerJwtClaims,
  expiresInSeconds: number,
): Promise<string> {
  const { SignJWT } = await loadJose();
  const privateKey = await getProvisioningPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    role: claims.role,
    ...(claims.org !== undefined ? { org: claims.org } : {}),
    ...(claims.name !== undefined ? { name: claims.name } : {}),
  })
    .setProtectedHeader({ alg: ALG, kid: config.jwtKeyId, typ: "JWT" })
    .setIssuer(config.jwtIssuer)
    .setAudience(config.jwtAudience)
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .setJti(randomUUID())
    .sign(privateKey);

  return token;
}

/** Verify a rescuer JWT (same rules as a rescuer app with the public key). */
export async function verifyRescuerJwt(token: string): Promise<VerifiedRescuerPayload> {
  const { importJWK, jwtVerify } = await loadJose();
  const publicJwk = await getProvisioningPublicJwk();
  const key = await importJWK(publicJwk, ALG);
  const { payload } = await jwtVerify(token, key, {
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    algorithms: [ALG],
  });
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Invalid token: missing sub");
  }
  return payload as VerifiedRescuerPayload;
}
