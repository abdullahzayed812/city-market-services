import { SEED_DATA, ShopStatus } from "@city-market/shared";
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
    const vendors = [
      {
        id: SEED_DATA.VENDORS.BEST_BURGER,
        user_id: SEED_DATA.USERS.VENDOR1,
        shop_name: "Best Burger",
        shop_description: "Delicious burgers and fries",
        phone: "+201000000001",
        address: "456 Food St, Borg El Arab",
        status: ShopStatus.OPEN,
        commission_rate: 10.0,
      },
      {
        id: SEED_DATA.VENDORS.PIZZA_PALACE,
        user_id: SEED_DATA.USERS.VENDOR2,
        shop_name: "Pizza Palace",
        shop_description: "Authentic Italian pizzas",
        phone: "+201000000002",
        address: "789 Pizza Ave, Alexandria",
        status: ShopStatus.OPEN,
        commission_rate: 12.0,
      },
    ];

    for (const vendor of vendors) {
      await connection.execute(
        "INSERT IGNORE INTO vendors (id, user_id, shop_name, shop_description, phone, address, status, commission_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          vendor.id,
          vendor.user_id,
          vendor.shop_name,
          vendor.shop_description,
          vendor.phone,
          vendor.address,
          vendor.status,
          vendor.commission_rate,
        ]
      );

      // Working hours (Mon-Sun: 9AM - 10PM)
      for (let day = 0; day < 7; day++) {
        await connection.execute(
          "INSERT IGNORE INTO working_hours (id, vendor_id, day_of_week, open_time, close_time, is_open) VALUES (?, ?, ?, ?, ?, ?)",
          [randomUUID(), vendor.id, day, "09:00:00", "22:00:00", true]
        );
      }
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
