import { SEED_DATA } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { randomUUID } from "crypto";
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
    // ── Offices ──────────────────────────────────────────────────────────────
    const offices = [
      { id: SEED_DATA.DELIVERY_OFFICES.MAIN_OFFICE, userId: SEED_DATA.USERS.DELIVERY_MANAGER, name: "مكتب برج العرب الرئيسي", phone: "+201000000001", address: "برج العرب الجديدة، الإسكندرية" },
      { id: SEED_DATA.DELIVERY_OFFICES.EAST_OFFICE, userId: SEED_DATA.USERS.DELIVERY_MANAGER_2, name: "مكتب برج العرب الشرقي", phone: "+201000000002", address: "المنطقة الصناعية، برج العرب، الإسكندرية" },
      { id: SEED_DATA.DELIVERY_OFFICES.WEST_OFFICE, userId: SEED_DATA.USERS.DELIVERY_MANAGER_3, name: "مكتب برج العرب الغربي", phone: "+201000000003", address: "الحي السابع، برج العرب، الإسكندرية" },
    ];

    for (const office of offices) {
      await connection.execute(
        `INSERT IGNORE INTO delivery_offices (id, user_id, name, phone, address, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        [office.id, office.userId, office.name, office.phone, office.address, true],
      );
    }

    // ── Couriers ─────────────────────────────────────────────────────────────
    const couriers = [
      // المكتب الرئيسي
      { id: SEED_DATA.COURIERS.MIKE, userId: SEED_DATA.USERS.COURIER, officeId: SEED_DATA.DELIVERY_OFFICES.MAIN_OFFICE, name: "محمد علي", phone: "+201222222222", vehicle: "Motorcycle", plate: "أ ب ج - 123" },
      { id: SEED_DATA.COURIERS.SARA, userId: SEED_DATA.USERS.COURIER_SARA, officeId: SEED_DATA.DELIVERY_OFFICES.MAIN_OFFICE, name: "طارق أحمد", phone: "+201333333301", vehicle: "Motorcycle", plate: "أ ب ج - 201" },
      { id: SEED_DATA.COURIERS.OMAR, userId: SEED_DATA.USERS.COURIER_OMAR, officeId: SEED_DATA.DELIVERY_OFFICES.MAIN_OFFICE, name: "عمر خالد", phone: "+201333333302", vehicle: "Bicycle", plate: "أ ب ج - 202" },
      // مكتب الشرق
      { id: SEED_DATA.COURIERS.LAYLA, userId: SEED_DATA.USERS.COURIER_LAYLA, officeId: SEED_DATA.DELIVERY_OFFICES.EAST_OFFICE, name: "وليد حسن", phone: "+201333333303", vehicle: "Motorcycle", plate: "د هـ و - 301" },
      { id: SEED_DATA.COURIERS.KARIM, userId: SEED_DATA.USERS.COURIER_KARIM, officeId: SEED_DATA.DELIVERY_OFFICES.EAST_OFFICE, name: "كريم سامي", phone: "+201333333304", vehicle: "Motorcycle", plate: "د هـ و - 302" },
      { id: SEED_DATA.COURIERS.NOUR, userId: SEED_DATA.USERS.COURIER_NOUR, officeId: SEED_DATA.DELIVERY_OFFICES.EAST_OFFICE, name: "ناصر محمد", phone: "+201333333305", vehicle: "Bicycle", plate: "د هـ و - 303" },
      // مكتب الغرب
      { id: SEED_DATA.COURIERS.HASSAN, userId: SEED_DATA.USERS.COURIER_HASSAN, officeId: SEED_DATA.DELIVERY_OFFICES.WEST_OFFICE, name: "حسن إبراهيم", phone: "+201333333306", vehicle: "Motorcycle", plate: "ز ح ط - 401" },
      { id: SEED_DATA.COURIERS.DINA, userId: SEED_DATA.USERS.COURIER_DINA, officeId: SEED_DATA.DELIVERY_OFFICES.WEST_OFFICE, name: "أحمد يوسف", phone: "+201333333307", vehicle: "Motorcycle", plate: "ز ح ط - 402" },
      { id: SEED_DATA.COURIERS.YASSER, userId: SEED_DATA.USERS.COURIER_YASSER, officeId: SEED_DATA.DELIVERY_OFFICES.WEST_OFFICE, name: "ياسر فتحي", phone: "+201333333308", vehicle: "Bicycle", plate: "ز ح ط - 403" },
    ];

    for (const courier of couriers) {
      await connection.execute(
        `INSERT IGNORE INTO couriers (id, user_id, delivery_office_id, full_name, phone, vehicle_type, license_plate, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [courier.id, courier.userId, courier.officeId, courier.name, courier.phone, courier.vehicle, courier.plate, true],
      );
    }

    // ── Delivery Fee Tiers ────────────────────────────────────────────────────
    // courier_percentage is the courier's share; office keeps (100 - courier_percentage)%
    const feeTiers = [
      { minAmount: 0,  maxAmount: 20,   courierPercentage: 60 }, // رسوم صغيرة: كوريير 60% / مكتب 40%
      { minAmount: 20, maxAmount: 40,   courierPercentage: 65 }, // رسوم متوسطة: كوريير 65% / مكتب 35%
      { minAmount: 40, maxAmount: 70,   courierPercentage: 70 }, // رسوم مرتفعة: كوريير 70% / مكتب 30%
      { minAmount: 70, maxAmount: null, courierPercentage: 75 }, // رسوم عالية جداً: كوريير 75% / مكتب 25%
    ];

    for (const tier of feeTiers) {
      await connection.execute(
        `INSERT IGNORE INTO delivery_fee_tiers (id, min_amount, max_amount, courier_percentage) VALUES (?, ?, ?, ?)`,
        [randomUUID(), tier.minAmount, tier.maxAmount, tier.courierPercentage],
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
    console.log("Seeding script finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding script failed:", err);
    process.exit(1);
  });
