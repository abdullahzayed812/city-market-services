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
        id: SEED_DATA.VENDORS.SUPER_MARKET_1,
        user_id: SEED_DATA.USERS.VENDOR1,
        shop_name: "El Borg Supermarket",
        shop_description: "Medium size supermarket covering all household essentials",
        phone: "+201111111111",
        address: "District 1, Borg El Arab",
        status: ShopStatus.OPEN,
        commission_rate: 8.0,
      },
      {
        id: SEED_DATA.VENDORS.SUPER_MARKET_2,
        user_id: SEED_DATA.USERS.VENDOR2,
        shop_name: "Family Market",
        shop_description: "Local grocery market for daily needs",
        phone: "+201111111112",
        address: "District 2, Borg El Arab",
        status: ShopStatus.OPEN,
        commission_rate: 8.0,
      },
      {
        id: SEED_DATA.VENDORS.PHARMACY,
        user_id: SEED_DATA.USERS.VENDOR3,
        shop_name: "El Borg Pharmacy",
        shop_description: "OTC medicine and personal care products",
        phone: "+201111111113",
        address: "Main Street, Borg El Arab",
        status: ShopStatus.OPEN,
        commission_rate: 10.0,
      },
      {
        id: SEED_DATA.VENDORS.BAKERY,
        user_id: SEED_DATA.USERS.VENDOR4,
        shop_name: "El Borg Bakery",
        shop_description: "Fresh bread and baked goods daily",
        phone: "+201111111114",
        address: "Near City Center, Borg El Arab",
        status: ShopStatus.OPEN,
        commission_rate: 7.0,
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

      for (let day = 0; day < 7; day++) {
        let openTime = "09:00:00";
        let closeTime = "22:00:00";

        // Pharmacy opens earlier
        if (vendor.id === SEED_DATA.VENDORS.PHARMACY) {
          openTime = "08:00:00";
          closeTime = "23:00:00";
        }

        // Bakery opens very early
        if (vendor.id === SEED_DATA.VENDORS.BAKERY) {
          openTime = "06:00:00";
          closeTime = "18:00:00";
        }

        await connection.execute(
          "INSERT IGNORE INTO working_hours (id, vendor_id, day_of_week, open_time, close_time, is_open) VALUES (?, ?, ?, ?, ?, ?)",
          [randomUUID(), vendor.id, day, openTime, closeTime, true]
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
