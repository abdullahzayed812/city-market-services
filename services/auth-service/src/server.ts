import { createApp } from "./app";
import { config } from "./config/env";
import { Logger } from "@city-market/shared/node";

const app = createApp();

app.listen(config.port, () => {
  Logger.info(`Auth Service running on port ${config.port}`);
});
