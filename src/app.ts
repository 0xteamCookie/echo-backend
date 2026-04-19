import express from "express";
import { errorHandler } from "./middleware/error-handler";
import { identifyUser } from "./middleware/authz";
import { accountRouter } from "./modules/account/account.routes";
import { dataRouter } from "./modules/data/data.routes";

export const app = express();

app.use(express.json());
app.use(identifyUser);

app.use("/api/account", accountRouter);
app.use("/api/data", dataRouter);

app.use(errorHandler);
