import "dotenv/config";
import { app } from "./app";
import { config } from "./lib/config";

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
