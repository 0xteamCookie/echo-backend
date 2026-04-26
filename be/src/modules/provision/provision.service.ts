import { config } from "../../lib/config";
import {
  signRescuerJwt,
  type RescuerJwtClaims,
} from "../../lib/jwt-provisioning";
import type { IssueTokenBody } from "./provision.schema";

export const provisionService = {
  async issueToken(
    body: IssueTokenBody,
  ): Promise<{ token: string; expiresInSeconds: number }> {
    const defaultTtl = config.jwtDefaultExpiresInSeconds;
    const maxTtl = config.jwtMaxExpiresInSeconds;
    const requested =
      typeof body.expiresInSeconds === "number"
        ? body.expiresInSeconds
        : defaultTtl;
    const expiresInSeconds = Math.min(
      Math.max(1, Math.floor(requested)),
      maxTtl,
    );

    const claims: RescuerJwtClaims = {
      sub: body.sub,
      role: body.role,
      agency: body.agency,
      name: body.name,
      radius_m: body.radius_m,
      lat: body.lat,
      lng: body.lng,
    };

    const token = await signRescuerJwt(claims, expiresInSeconds);
    return { token, expiresInSeconds };
  },
};
