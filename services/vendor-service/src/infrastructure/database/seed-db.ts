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
        user_id: SEED_DATA.USERS.MADINATY_SUPERMARKET,
        shop_name: "سوبر ماركت مدينتي",
        address: "الحي الأول",
        type: "Supermarket",
      },
      {
        id: SEED_DATA.VENDORS.SUPER_MARKET_2,
        user_id: SEED_DATA.USERS.AL_JAZIRA_SUPERMARKET,
        shop_name: "سوبر ماركت الجزيرة",
        address: "الحي الأول",
        type: "Supermarket",
      },
      {
        id: SEED_DATA.VENDORS.AWLAD_RAGAB,
        user_id: SEED_DATA.USERS.AWLAD_RAGAB,
        shop_name: "خضروات وفاكهة أولاد رجب",
        address: "الحي الأول",
        type: "VegFruit",
      },
      {
        id: SEED_DATA.VENDORS.SANAQREH,
        user_id: SEED_DATA.USERS.SANAQREH,
        shop_name: "سوبر ماركت السناقرة",
        address: "الحي الأول",
        type: "Supermarket",
      },
      {
        id: SEED_DATA.VENDORS.PHARMACY,
        user_id: SEED_DATA.USERS.MOATAZ_PHARMACY,
        shop_name: "صيدلية معتز",
        address: "الحي الأول",
        type: "Pharmacy",
      },
      {
        id: SEED_DATA.VENDORS.AHMED_YEHIA,
        user_id: SEED_DATA.USERS.AHMED_YEHIA,
        shop_name: "صيدلية أحمد يحيى",
        address: "الحي الأول",
        type: "Pharmacy",
      },
      {
        id: SEED_DATA.VENDORS.SABAWI,
        user_id: SEED_DATA.USERS.SABAWI,
        shop_name: "صيدلية السبعاوي",
        address: "الحي الأول",
        type: "Pharmacy",
      },
      {
        id: SEED_DATA.VENDORS.BUTCHER,
        user_id: SEED_DATA.USERS.AL_RADWA_BUTCHER,
        shop_name: "جزارة الرضوى",
        address: "الحي الأول",
        type: "Butcher",
      },
      {
        id: SEED_DATA.VENDORS.ABDULLAH_BUTCHER,
        user_id: SEED_DATA.USERS.ABDULLAH_BUTCHER,
        shop_name: "جزارة عبدالله",
        address: "الحي الأول",
        type: "Butcher",
      },
      {
        id: SEED_DATA.VENDORS.POULTRY,
        user_id: SEED_DATA.USERS.AL_HAKEEM_POULTRY,
        shop_name: "دواجن آل حكيم",
        address: "الحي الأول",
        type: "Poultry",
      },
      {
        id: SEED_DATA.VENDORS.BEHEIRY_POULTRY,
        user_id: SEED_DATA.USERS.BEHEIRY_POULTRY,
        shop_name: "طيور البحيري",
        address: "الحي الأول",
        type: "Poultry",
      },
      {
        id: SEED_DATA.VENDORS.FISH,
        user_id: SEED_DATA.USERS.AL_HAKEEM_FISH,
        shop_name: "أسماك آل حكيم",
        address: "الحي الأول",
        type: "Fish",
      },
      {
        id: SEED_DATA.VENDORS.GHANEM_FISH,
        user_id: SEED_DATA.USERS.GHANEM_FISH,
        shop_name: "أسماك غانم",
        address: "الحي الأول",
        type: "Fish",
      },
      {
        id: SEED_DATA.VENDORS.MUTAWAKKIL_FISH,
        user_id: SEED_DATA.USERS.MUTAWAKKIL_FISH,
        shop_name: "أسماك المتوكل",
        address: "الحي الأول",
        type: "Fish",
      },
      {
        id: SEED_DATA.VENDORS.ABU_YOUSSEF_FISH,
        user_id: SEED_DATA.USERS.ABU_YOUSSEF_FISH,
        shop_name: "أسماك أبو يوسف",
        address: "الحي الأول",
        type: "Fish",
      },
      {
        id: SEED_DATA.VENDORS.BONDOQA,
        user_id: SEED_DATA.USERS.BONDOQA,
        shop_name: "مقلاة بندقة",
        address: "الحي الأول",
        type: "Roastery",
      },
      {
        id: SEED_DATA.VENDORS.ASHRI,
        user_id: SEED_DATA.USERS.ASHRI,
        shop_name: "مقلاة العشري",
        address: "الحي الأول",
        type: "Roastery",
      },
      {
        id: SEED_DATA.VENDORS.LOZINA,
        user_id: SEED_DATA.USERS.LOZINA,
        shop_name: "مقلاة لوزينا",
        address: "الحي الأول",
        type: "Roastery",
      },
      {
        id: SEED_DATA.VENDORS.BAKERY,
        user_id: SEED_DATA.USERS.EL_MADINA_BAKERY,
        shop_name: "مخبز المدينة",
        address: "الحي الأول",
        type: "Bakery",
      },
      {
        id: SEED_DATA.VENDORS.AL_BARAKA_BAKERY,
        user_id: SEED_DATA.USERS.AL_BARAKA_BAKERY,
        shop_name: "مخبز البركة",
        address: "الحي الأول",
        type: "Bakery",
      },
      {
        id: SEED_DATA.VENDORS.ABU_OMAR,
        user_id: SEED_DATA.USERS.ABU_OMAR,
        shop_name: "حلواني أبو عمر",
        address: "الحي الأول",
        type: "Pastry",
      },
      {
        id: SEED_DATA.VENDORS.RAWAN,
        user_id: SEED_DATA.USERS.RAWAN,
        shop_name: "حلواني روان",
        address: "الحي الأول",
        type: "Pastry",
      },
      {
        id: SEED_DATA.VENDORS.SHADY_LIBRARY,
        user_id: SEED_DATA.USERS.SHADY_LIBRARY,
        shop_name: "مكتبة شادي",
        address: "الحي الأول",
        type: "Stationery",
      },
      {
        id: SEED_DATA.VENDORS.MAZAARE_AL_KHEIR,
        user_id: SEED_DATA.USERS.MAZAARE_AL_KHEIR,
        shop_name: "مزارع الخير",
        address: "الحي الأول",
        type: "VegFruit",
      },
    ];

    for (const v of vendors) {
      await connection.execute(
        "INSERT IGNORE INTO vendors (id, user_id, shop_name, shop_description, phone, address, type, status, commission_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          v.id,
          v.user_id,
          v.shop_name,
          `${v.shop_name} - ${v.address}`,
          "+20100000000",
          v.address,
          v.type,
          ShopStatus.OPEN,
          10.0,
        ],
      );

      for (let day = 0; day < 7; day++) {
        await connection.execute(
          "INSERT IGNORE INTO working_hours (id, vendor_id, day_of_week, open_time, close_time, is_open) VALUES (?, ?, ?, ?, ?, ?)",
          [randomUUID(), v.id, day, "08:00:00", "23:59:00", true],
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
