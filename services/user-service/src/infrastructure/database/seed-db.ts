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
    const customerId = SEED_DATA.CUSTOMERS.JOHN_DOE;
    const userId = SEED_DATA.USERS.CUSTOMER;

    await connection.execute("INSERT IGNORE INTO customers (id, user_id, full_name, phone) VALUES (?, ?, ?, ?)", [
      customerId,
      userId,
      "أحمد محمد السيد",
      "+201234567890",
    ]);

    const addresses = [
      {
        id: randomUUID(),
        customer_id: customerId,
        label: "البيت",
        address: "حي المحطة، بناية رقم 7، شقة رقم 3",
        latitude: 30.9123,
        longitude: 29.6789,
        is_default: true,
      },
      {
        id: randomUUID(),
        customer_id: customerId,
        label: "الشغل",
        address: "حي المنطقة الصناعية، بناية رقم 14، شقة رقم 1",
        latitude: 30.8976,
        longitude: 29.6541,
        is_default: false,
      },
      {
        id: randomUUID(),
        customer_id: customerId,
        label: "بيت الأهل",
        address: "حي النصر، بناية رقم 22، شقة رقم 9",
        latitude: 30.9201,
        longitude: 29.6834,
        is_default: false,
      },
      {
        id: randomUUID(),
        customer_id: customerId,
        label: "النادي",
        address: "نادي سموحة برج العرب، الحي الأول",
        latitude: 30.9145,
        longitude: 29.6123,
        is_default: false,
      },
    ];

    for (const addr of addresses) {
      await connection.execute(
        "INSERT IGNORE INTO addresses (id, customer_id, label, address, latitude, longitude, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [addr.id, addr.customer_id, addr.label, addr.address, addr.latitude, addr.longitude, addr.is_default],
      );
    }

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
