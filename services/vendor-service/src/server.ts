import { createApp } from "./app";
import { config } from "./config/env";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

const start = async () => {
  try {
    const app = await createApp();
    app.listen(config.port, async () => {
      await rabbitMQBus.connect();
      Logger.info(`Vendor Service running on port ${config.port}`);
    });
  } catch (error) {
    Logger.error("Failed to start Vendor Service:", error);
    process.exit(1);
  }
};

start();
