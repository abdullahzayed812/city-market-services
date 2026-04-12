import { SEED_DATA } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";

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
    const courierId = SEED_DATA.COURIERS.MIKE;
    const userId = SEED_DATA.USERS.COURIER;

    // ✅ Insert Courier
    await connection.execute(
      `INSERT IGNORE INTO couriers 
            (id, user_id, full_name, phone, vehicle_type, license_plate, is_available) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [courierId, userId, "Mike Courier", "+201222222222", "Motorcycle", "ABC-123", true]
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
    console.log("Seeding script finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding script failed:", err);
    process.exit(1);
  });
