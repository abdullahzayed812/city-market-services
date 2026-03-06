import { SEED_DATA } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import bcrypt from "bcrypt";
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
    const passwordHash = await bcrypt.hash("password123", 10);

    const users = [
      {
        id: SEED_DATA.USERS.ADMIN,
        email: "admin@citymarket.com",
        password_hash: passwordHash,
        role: "ADMIN",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.CUSTOMER,
        email: "customer@citymarket.com",
        password_hash: passwordHash,
        role: "CUSTOMER",
        is_active: true,
      },
      // SuperMarket 1
      {
        id: SEED_DATA.USERS.VENDOR1,
        email: "supermarket1@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      // SuperMarket 2
      {
        id: SEED_DATA.USERS.VENDOR2,
        email: "supermarket2@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      // Pharmacy
      {
        id: SEED_DATA.USERS.VENDOR3,
        email: "pharmacy@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      // Bakery
      {
        id: SEED_DATA.USERS.VENDOR4,
        email: "bakery@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      // Butcher – جزار
      {
        id: SEED_DATA.USERS.VENDOR5,
        email: "butcher@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      // Poultry – محل دواجن
      {
        id: SEED_DATA.USERS.VENDOR6,
        email: "poultry@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      // Fish – محل أسماك
      {
        id: SEED_DATA.USERS.VENDOR7,
        email: "fish@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.COURIER,
        email: "courier@citymarket.com",
        password_hash: passwordHash,
        role: "COURIER",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.DELIVERY_MANAGER,
        email: "deliverymanager@citymarket.com",
        password_hash: passwordHash,
        role: "DELIVERY_MANAGER",
        is_active: true,
      },
    ];

    for (const user of users) {
      await connection.execute(
        "INSERT IGNORE INTO users (id, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)",
        [user.id, user.email, user.password_hash, user.role, user.is_active],
      );
    }

    console.log("Users seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedDb();
