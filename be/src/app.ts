import path from "node:path";
import cors from "cors";
import express from "express";
import { config } from "./lib/config";
import { errorHandler } from "./middleware/error-handler";
import { identifyUser } from "./middleware/authz";
import { accountRouter } from "./modules/account/account.routes";
import { dataRouter } from "./modules/data/data.routes";

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(identifyUser);

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.use("/api/account", accountRouter);
app.use("/api/data", dataRouter);

app.use(errorHandler);
