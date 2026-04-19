import path from "node:path";
import cors from "cors";
import express from "express";
import { getProvisioningPublicJwk } from "./lib/jwt-provisioning";
import { config } from "./lib/config";
import { errorHandler } from "./middleware/error-handler";
import { identifyUser } from "./middleware/authz";
import { accountRouter } from "./modules/account/account.routes";
import { dataRouter } from "./modules/data/data.routes";
import { provisionRouter } from "./modules/provision/provision.routes";

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

/** Public JWKS for rescuer apps verifying RS256 tokens offline or online. */
app.get("/.well-known/jwks.json", async (_req, res) => {
  try {
    const jwk = await getProvisioningPublicJwk();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({ keys: [jwk] });
  } catch {
    res.status(503).json({ error: "JWKS not available (configure JWT_PRIVATE_KEY)" });
  }
});

app.use("/api/provision", provisionRouter);

app.use(identifyUser);

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.use("/api/account", accountRouter);
app.use("/api/data", dataRouter);

app.use(errorHandler);
