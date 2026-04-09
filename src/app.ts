import express from "express";
import { errorHandler } from "./middleware/error-handler";
import { identifyUser } from "./middleware/authz";
import { dataRouter } from "./modules/data/data.routes";

export const app = express();

app.use(express.json());
app.use(identifyUser);

app.use("/api/data", dataRouter);

app.use(errorHandler);
