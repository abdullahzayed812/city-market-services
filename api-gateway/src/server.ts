import { createApp } from "./app";
import { config } from "./config/env";
import { Logger } from "@city-market/shared/node";

const app = createApp();

app.listen(config.port, () => {
  Logger.info(`API Gateway running on port ${config.port}`);
  Logger.info("Service endpoints:", {
    auth: config.authServiceUrl,
    user: config.userServiceUrl,
    vendor: config.vendorServiceUrl,
    catalog: config.catalogServiceUrl,
    order: config.orderServiceUrl,
    delivery: config.deliveryServiceUrl,
    admin: config.adminServiceUrl,
  });
});
