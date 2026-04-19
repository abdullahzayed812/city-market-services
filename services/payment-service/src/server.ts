import { app } from "./app.js";
import { config } from "./config/env.js";
import { Logger } from "@city-market/shared/node";

const PORT = config.port;

app.listen(PORT, () => {
  Logger.info(`Payment Service running on port ${PORT}`);
});
