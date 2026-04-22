import "dotenv/config";
import { app } from "./app";
import { config } from "./lib/config";
import { log } from "./lib/logger";

app.listen(config.port, () => {
  log.info("server.listen", { port: config.port });
});
