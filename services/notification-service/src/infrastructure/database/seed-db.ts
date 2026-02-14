import { SEED_DATA } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { randomUUID } from "crypto";

const seedDb = async () => {
    const db = Database.getInstance({
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.dbName,
    });
    const connection = db.getPool();

    try {
        const userId = SEED_DATA.USERS.CUSTOMER;

        await connection.execute(
            "INSERT IGNORE INTO notifications (id, user_id, type, title, message, is_read) VALUES (?, ?, ?, ?, ?, ?)",
            [randomUUID(), userId, "SYSTEM", "Welcome", "Welcome to CityMarket!", false]
        );

        await connection.execute(
            "INSERT IGNORE INTO notification_preferences (user_id, email_enabled, push_enabled, sms_enabled) VALUES (?, ?, ?, ?)",
            [userId, true, true, false]
        );

        console.log("Database seeded successfully");
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    } finally {
        await connection.end();
    }
};

seedDb();
