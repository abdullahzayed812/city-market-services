import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { Logger } from "@city-market/shared/node";

const app = createApp();

app.listen(config.port, () => {
  Logger.info(`Media Service running on port ${config.port}`);
});
