import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { randomUUID } from "crypto";

const seedDb = async () => {
    const db = new Database({
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.dbName
    });

    try {
        // Seed some summaries
        const vendorIds = [randomUUID(), randomUUID()];

        for (const vendorId of vendorIds) {
            await db.getPool().execute(
                "INSERT INTO vendor_rating_summary (vendor_id, total_ratings, total_stars, average_rating) VALUES (?, ?, ?, ?)",
                [vendorId, 1, 5, 5.0]
            );
        }

        console.log("Database seeded successfully.");
        await db.close();
    } catch (error) {
        console.error("Failed to seed database:", error);
        process.exit(1);
    }
};

seedDb();
