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
    const orderId = SEED_DATA.ORDERS.ORDER_1;

    await connection.execute(
      "INSERT IGNORE INTO payments (id, order_id, amount, currency, status, payment_method, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), orderId, 80.0, "EGP", "COMPLETED", "CASH", null],
    );

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    await db.close();
  }
};

seedDb()
  .then(() => {
    console.log("Seed script finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed script failed:", err);
    process.exit(1);
  });
