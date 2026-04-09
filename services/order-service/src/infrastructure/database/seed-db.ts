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
    // Commission Tiers Seeds
    const tiers = [
      { min: 0, max: 200, percentage: 1.0 },
      { min: 200, max: 500, percentage: 2.0 },
      { min: 500, max: 1000, percentage: 3.0 },
      { min: 1000, max: 2000, percentage: 4.0 },
    ];

    for (const tier of tiers) {
      await connection.execute(
        "INSERT IGNORE INTO commission_tiers (id, min_amount, max_amount, percentage) VALUES (?, ?, ?, ?)",
        [randomUUID(), tier.min, tier.max, tier.percentage],
      );
    }

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedDb();
