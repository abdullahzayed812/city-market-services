import { createApp } from "./app";
import { config } from "./config/env";
import { Logger, Database, rabbitMQBus } from "@city-market/shared/node";
import { NotificationRepository } from "./infrastructure/repositories/notification.repository";
import { PushNotificationProvider } from "./infrastructure/providers/push.provider";
import { NotificationService } from "./application/services/notification.service";
import { EventConsumer } from "./presentation/consumers/event.consumer";

const startServer = async () => {
  try {
    // 1. Database
    const db = Database.getInstance({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
    });

    // 2. RabbitMQ
    await rabbitMQBus.connect();

    // 3. Dependencies
    const repo = new NotificationRepository(db);
    const pushProvider = new PushNotificationProvider();
    const service = new NotificationService(repo, pushProvider);

    // 4. Consumers
    const consumer = new EventConsumer(service);
    await consumer.start();

    // 5. Express App
    const app = createApp(service); // Need to update app.ts to accept service

    app.listen(config.port, () => {
      Logger.info(`Notification Service running on port ${config.port}`);
    });
  } catch (error) {
    Logger.error("Failed to start Notification Service", error);
    process.exit(1);
  }
};

startServer();
