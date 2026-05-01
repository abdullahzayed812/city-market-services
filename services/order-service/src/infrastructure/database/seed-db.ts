import { Database } from "@city-market/shared/node";
import { SEED_DATA, VendorType } from "@city-market/shared";
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
      // Global Tiers (Defaults)
      { vendorId: null, vendorType: null, min: 0, max: 200, percentage: 2.0 },
      { vendorId: null, vendorType: null, min: 200, max: 500, percentage: 3.0 },
      { vendorId: null, vendorType: null, min: 500, max: 1000, percentage: 4.0 },
      { vendorId: null, vendorType: null, min: 1000, max: null, percentage: 5.0 },

      // All Vendor Type Tiers based on realistic market margins
      { vendorId: null, vendorType: VendorType.Supermarket, min: 0, max: null, percentage: 2.5 },
      { vendorId: null, vendorType: VendorType.VegFruit, min: 0, max: null, percentage: 6.0 },
      { vendorId: null, vendorType: VendorType.Pharmacy, min: 0, max: null, percentage: 1.5 },
      { vendorId: null, vendorType: VendorType.Butcher, min: 0, max: null, percentage: 5.0 },
      { vendorId: null, vendorType: VendorType.Poultry, min: 0, max: null, percentage: 5.0 },
      { vendorId: null, vendorType: VendorType.Fish, min: 0, max: null, percentage: 6.0 },
      { vendorId: null, vendorType: VendorType.Roastery, min: 0, max: null, percentage: 8.5 },
      { vendorId: null, vendorType: VendorType.Bakery, min: 0, max: null, percentage: 10.0 },
      { vendorId: null, vendorType: VendorType.Pastry, min: 0, max: null, percentage: 12.0 },
      { vendorId: null, vendorType: VendorType.Stationery, min: 0, max: null, percentage: 12.5 },

      // Specific Vendor Tiers (e.g. Awlad Ragab override)
      { vendorId: SEED_DATA.VENDORS.AWLAD_RAGAB, vendorType: null, min: 0, max: null, percentage: 4.5 },
    ];

    for (const tier of tiers) {
      await connection.execute(
        "INSERT IGNORE INTO commission_tiers (id, vendor_id, vendor_type, min_amount, max_amount, percentage) VALUES (?, ?, ?, ?, ?, ?)",
        [randomUUID(), tier.vendorId, tier.vendorType, tier.min, tier.max, tier.percentage],
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
