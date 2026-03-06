import { createApp } from "./app";
import { config } from "./config/env";
import { Logger } from "@city-market/shared/node";

const app = createApp();

app.listen(config.port, () => {
  Logger.info(`API Gateway running on port ${config.port}`);
  Logger.info("Service endpoints:", {
    user: config.userServiceUrl,
    order: config.orderServiceUrl,
    auth: config.authServiceUrl,
    admin: config.adminServiceUrl,
    vendor: config.vendorServiceUrl,
    catalog: config.catalogServiceUrl,
    delivery: config.deliveryServiceUrl,
    notifications: config.notificationsServiceUrl,
    rating: config.ratingServiceUrl,
  });
});
