import { SEED_DATA, ShopStatus } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { randomUUID } from "crypto";

// Fixed IDs for cross-service consistency
export const VENDOR_IDS = {
  SANAQREH: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a40",
  AHMED_YEHIA: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41",
  SABAWI: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42",
  ABDULLAH_BUTCHER: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43",
  BEHEIRY_POULTRY: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
  GHANEM_FISH: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a45",
  MUTAWAKKIL_FISH: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a46",
  ABU_YOUSSEF_FISH: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a47",
  BONDOQA: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a48",
  ASHRI: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a49",
  LOZINA: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a50",
  AL_BARAKA_BAKERY: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51",
  ABU_OMAR: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a52",
  RAWAN: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a53",
  SHADY_LIBRARY: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a54",
  AWLAD_RAGAB: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55",
  MAZAARE_AL_KHEIR: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a56",
};

// Fixed User IDs for vendors (must match auth-service seeds)
const VENDOR_USER_IDS = {
  SANAQREH: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30",
  AHMED_YEHIA: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31",
  SABAWI: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32",
  ABDULLAH_BUTCHER: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
  BEHEIRY_POULTRY: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a34",
  GHANEM_FISH: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a35",
  MUTAWAKKIL_FISH: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a36",
  ABU_YOUSSEF_FISH: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a37",
  BONDOQA: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a38",
  ASHRI: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a39",
  LOZINA: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a40",
  AL_BARAKA_BAKERY: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41",
  ABU_OMAR: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42",
  RAWAN: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43",
  SHADY_LIBRARY: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
  AWLAD_RAGAB: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a45",
  MAZAARE_AL_KHEIR: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a46",
};

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
      { id: SEED_DATA.VENDORS.SUPER_MARKET_1, user_id: SEED_DATA.USERS.VENDOR1, shop_name: "سوبر ماركت مدينتي", address: "الحي الأول", type: "Supermarket" },
      { id: SEED_DATA.VENDORS.SUPER_MARKET_2, user_id: SEED_DATA.USERS.VENDOR2, shop_name: "سوبر ماركت الجزيرة", address: "الحي الأول", type: "Supermarket" },
      { id: VENDOR_IDS.SANAQREH, user_id: VENDOR_USER_IDS.SANAQREH, shop_name: "سوبر ماركت السناقرة", address: "الحي الأول", type: "Supermarket" },
      { id: SEED_DATA.VENDORS.PHARMACY, user_id: SEED_DATA.USERS.VENDOR3, shop_name: "صيدلية معتز", address: "الحي الأول", type: "Pharmacy" },
      { id: VENDOR_IDS.AHMED_YEHIA, user_id: VENDOR_USER_IDS.AHMED_YEHIA, shop_name: "صيدلية أحمد يحيى", address: "الحي الأول", type: "Pharmacy" },
      { id: VENDOR_IDS.SABAWI, user_id: VENDOR_USER_IDS.SABAWI, shop_name: "صيدلية السبعاوي", address: "الحي الأول", type: "Pharmacy" },
      { id: SEED_DATA.VENDORS.BUTCHER, user_id: SEED_DATA.USERS.VENDOR5, shop_name: "جزارة الرضوى", address: "الحي الأول", type: "Butcher" },
      { id: VENDOR_IDS.ABDULLAH_BUTCHER, user_id: VENDOR_USER_IDS.ABDULLAH_BUTCHER, shop_name: "جزارة عبدالله", address: "الحي الأول", type: "Butcher" },
      { id: SEED_DATA.VENDORS.POULTRY, user_id: SEED_DATA.USERS.VENDOR6, shop_name: "دواجن آل حكيم", address: "الحي الأول", type: "Poultry" },
      { id: VENDOR_IDS.BEHEIRY_POULTRY, user_id: VENDOR_USER_IDS.BEHEIRY_POULTRY, shop_name: "طيور البحيري", address: "الحي الأول", type: "Poultry" },
      { id: SEED_DATA.VENDORS.FISH, user_id: SEED_DATA.USERS.VENDOR7, shop_name: "أسماك آل حكيم", address: "الحي الأول", type: "Fish" },
      { id: VENDOR_IDS.GHANEM_FISH, user_id: VENDOR_USER_IDS.GHANEM_FISH, shop_name: "أسماك غانم", address: "الحي الأول", type: "Fish" },
      { id: VENDOR_IDS.MUTAWAKKIL_FISH, user_id: VENDOR_USER_IDS.MUTAWAKKIL_FISH, shop_name: "أسماك المتوكل", address: "الحي الأول", type: "Fish" },
      { id: VENDOR_IDS.ABU_YOUSSEF_FISH, user_id: VENDOR_USER_IDS.ABU_YOUSSEF_FISH, shop_name: "أسماك أبو يوسف", address: "الحي الأول", type: "Fish" },
      { id: VENDOR_IDS.BONDOQA, user_id: VENDOR_USER_IDS.BONDOQA, shop_name: "مقلاة بندقة", address: "الحي الأول", type: "Roastery" },
      { id: VENDOR_IDS.ASHRI, user_id: VENDOR_USER_IDS.ASHRI, shop_name: "مقلاة العشري", address: "الحي الأول", type: "Roastery" },
      { id: VENDOR_IDS.LOZINA, user_id: VENDOR_USER_IDS.LOZINA, shop_name: "مقلاة لوزينا", address: "الحي الأول", type: "Roastery" },
      { id: SEED_DATA.VENDORS.BAKERY, user_id: SEED_DATA.USERS.VENDOR4, shop_name: "مخبز المدينة", address: "الحي الأول", type: "Bakery" },
      { id: VENDOR_IDS.AL_BARAKA_BAKERY, user_id: VENDOR_USER_IDS.AL_BARAKA_BAKERY, shop_name: "مخبز البركة", address: "الحي الأول", type: "Bakery" },
      { id: VENDOR_IDS.ABU_OMAR, user_id: VENDOR_USER_IDS.ABU_OMAR, shop_name: "حلواني أبو عمر", address: "الحي الأول", type: "Pastry" },
      { id: VENDOR_IDS.RAWAN, user_id: VENDOR_USER_IDS.RAWAN, shop_name: "حلواني روان", address: "الحي الأول", type: "Pastry" },
      { id: VENDOR_IDS.SHADY_LIBRARY, user_id: VENDOR_USER_IDS.SHADY_LIBRARY, shop_name: "مكتبة شادي", address: "الحي الأول", type: "Stationery" },
      { id: VENDOR_IDS.AWLAD_RAGAB, user_id: VENDOR_USER_IDS.AWLAD_RAGAB, shop_name: "خضروات وفاكهة أولاد رجب", address: "الحي الأول", type: "VegFruit" },
      { id: VENDOR_IDS.MAZAARE_AL_KHEIR, user_id: VENDOR_USER_IDS.MAZAARE_AL_KHEIR, shop_name: "مزارع الخير", address: "الحي الأول", type: "VegFruit" },
    ];

    for (const v of vendors) {
      await connection.execute(
        "INSERT IGNORE INTO vendors (id, user_id, shop_name, shop_description, phone, address, type, status, commission_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [v.id, v.user_id, v.shop_name, `${v.shop_name} - ${v.address}`, "+20100000000", v.address, v.type, ShopStatus.OPEN, 10.0]
      );

      for (let day = 0; day < 7; day++) {
        await connection.execute(
          "INSERT IGNORE INTO working_hours (id, vendor_id, day_of_week, open_time, close_time, is_open) VALUES (?, ?, ?, ?, ?, ?)",
          [randomUUID(), v.id, day, "08:00:00", "23:59:00", true]
        );
      }
    }

    console.log("Vendor seeding complete with fixed IDs.");
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedDb();
