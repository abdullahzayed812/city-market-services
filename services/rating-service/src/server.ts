import { createApp } from "./app";
import { config, ratingServiceAuthenticator } from "./config/env";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

const start = async () => {
    try {
        const app = await createApp();
        app.listen(config.port, async () => {
            await rabbitMQBus.connect();

            // Pre-warm the authenticator — non-fatal if auth-service isn't ready yet
            try {
                await ratingServiceAuthenticator.getServiceToken();
                Logger.info("RatingService authenticator initialized successfully.");
            } catch (err) {
                Logger.warn("RatingService: Could not pre-fetch service token (auth-service may not be ready yet). It will be retried on first use.");
            }

            Logger.info(`Rating Service listening on port ${config.port}`);
        });
    } catch (error) {
        Logger.error("Failed to start Rating Service", error);
        process.exit(1);
    }
};

start();
