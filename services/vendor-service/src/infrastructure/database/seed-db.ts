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
        lat: 30.9167,
        lng: 29.6101,
      },
      {
        id: SEED_DATA.VENDORS.SUPER_MARKET_2,
        user_id: SEED_DATA.USERS.AL_JAZIRA_SUPERMARKET,
        shop_name: "سوبر ماركت الجزيرة",
        address: "الحي الأول",
        type: "Supermarket",
        lat: 30.9172,
        lng: 29.6115,
      },
      {
        id: SEED_DATA.VENDORS.AWLAD_RAGAB,
        user_id: SEED_DATA.USERS.AWLAD_RAGAB,
        shop_name: "خضروات وفاكهة أولاد رجب",
        address: "الحي الأول",
        type: "VegFruit",
        lat: 30.9155,
        lng: 29.6128,
      },
      {
        id: SEED_DATA.VENDORS.SANAQREH,
        user_id: SEED_DATA.USERS.SANAQREH,
        shop_name: "سوبر ماركت السناقرة",
        address: "الحي الأول",
        type: "Supermarket",
        lat: 30.9181,
        lng: 29.6132,
      },
      {
        id: SEED_DATA.VENDORS.PHARMACY,
        user_id: SEED_DATA.USERS.MOATAZ_PHARMACY,
        shop_name: "صيدلية معتز",
        address: "الحي الأول",
        type: "Pharmacy",
        lat: 30.9162,
        lng: 29.6145,
      },
      {
        id: SEED_DATA.VENDORS.AHMED_YEHIA,
        user_id: SEED_DATA.USERS.AHMED_YEHIA,
        shop_name: "صيدلية أحمد يحيى",
        address: "الحي الأول",
        type: "Pharmacy",
        lat: 30.9158,
        lng: 29.6152,
      },
      {
        id: SEED_DATA.VENDORS.SABAWI,
        user_id: SEED_DATA.USERS.SABAWI,
        shop_name: "صيدلية السبعاوي",
        address: "الحي الأول",
        type: "Pharmacy",
        lat: 30.9175,
        lng: 29.6163,
      },
      {
        id: SEED_DATA.VENDORS.BUTCHER,
        user_id: SEED_DATA.USERS.AL_RADWA_BUTCHER,
        shop_name: "جزارة الرضوى",
        address: "الحي الأول",
        type: "Butcher",
        lat: 30.9149,
        lng: 29.6171,
      },
      {
        id: SEED_DATA.VENDORS.ABDULLAH_BUTCHER,
        user_id: SEED_DATA.USERS.ABDULLAH_BUTCHER,
        shop_name: "جزارة عبدالله",
        address: "الحي الأول",
        type: "Butcher",
        lat: 30.9135,
        lng: 29.6182,
      },
      {
        id: SEED_DATA.VENDORS.POULTRY,
        user_id: SEED_DATA.USERS.AL_HAKEEM_POULTRY,
        shop_name: "دواجن آل حكيم",
        address: "الحي الأول",
        type: "Poultry",
        lat: 30.9122,
        lng: 29.6191,
      },
      {
        id: SEED_DATA.VENDORS.BEHEIRY_POULTRY,
        user_id: SEED_DATA.USERS.BEHEIRY_POULTRY,
        shop_name: "طيور البحيري",
        address: "الحي الأول",
        type: "Poultry",
        lat: 30.9115,
        lng: 29.6202,
      },
      {
        id: SEED_DATA.VENDORS.FISH,
        user_id: SEED_DATA.USERS.AL_HAKEEM_FISH,
        shop_name: "أسماك آل حكيم",
        address: "الحي الأول",
        type: "Fish",
        lat: 30.9102,
        lng: 29.6215,
      },
      {
        id: SEED_DATA.VENDORS.GHANEM_FISH,
        user_id: SEED_DATA.USERS.GHANEM_FISH,
        shop_name: "أسماك غانم",
        address: "الحي الأول",
        type: "Fish",
        lat: 30.9095,
        lng: 29.6228,
      },
      {
        id: SEED_DATA.VENDORS.MUTAWAKKIL_FISH,
        user_id: SEED_DATA.USERS.MUTAWAKKIL_FISH,
        shop_name: "أسماك المتوكل",
        address: "الحي الأول",
        type: "Fish",
        lat: 30.9082,
        lng: 29.6231,
      },
      {
        id: SEED_DATA.VENDORS.ABU_YOUSSEF_FISH,
        user_id: SEED_DATA.USERS.ABU_YOUSSEF_FISH,
        shop_name: "أسماك أبو يوسف",
        address: "الحي الأول",
        type: "Fish",
        lat: 30.9075,
        lng: 29.6245,
      },
      {
        id: SEED_DATA.VENDORS.BONDOQA,
        user_id: SEED_DATA.USERS.BONDOQA,
        shop_name: "مقلاة بندقة",
        address: "الحي الأول",
        type: "Roastery",
        lat: 30.9192,
        lng: 29.6251,
      },
      {
        id: SEED_DATA.VENDORS.ASHRI,
        user_id: SEED_DATA.USERS.ASHRI,
        shop_name: "مقلاة العشري",
        address: "الحي الأول",
        type: "Roastery",
        lat: 30.9205,
        lng: 29.6262,
      },
      {
        id: SEED_DATA.VENDORS.LOZINA,
        user_id: SEED_DATA.USERS.LOZINA,
        shop_name: "مقلاة لوزينا",
        address: "الحي الأول",
        type: "Roastery",
        lat: 30.9212,
        lng: 29.6275,
      },
      {
        id: SEED_DATA.VENDORS.BAKERY,
        user_id: SEED_DATA.USERS.EL_MADINA_BAKERY,
        shop_name: "مخبز المدينة",
        address: "الحي الأول",
        type: "Bakery",
        lat: 30.9225,
        lng: 29.6281,
      },
      {
        id: SEED_DATA.VENDORS.AL_BARAKA_BAKERY,
        user_id: SEED_DATA.USERS.AL_BARAKA_BAKERY,
        shop_name: "مخبز البركة",
        address: "الحي الأول",
        type: "Bakery",
        lat: 30.9232,
        lng: 29.6295,
      },
      {
        id: SEED_DATA.VENDORS.ABU_OMAR,
        user_id: SEED_DATA.USERS.ABU_OMAR,
        shop_name: "حلواني أبو عمر",
        address: "الحي الأول",
        type: "Pastry",
        lat: 30.9245,
        lng: 29.6301,
      },
      {
        id: SEED_DATA.VENDORS.RAWAN,
        user_id: SEED_DATA.USERS.RAWAN,
        shop_name: "حلواني روان",
        address: "الحي الأول",
        type: "Pastry",
        lat: 30.9252,
        lng: 29.6315,
      },
      {
        id: SEED_DATA.VENDORS.SHADY_LIBRARY,
        user_id: SEED_DATA.USERS.SHADY_LIBRARY,
        shop_name: "مكتبة شادي",
        address: "الحي الأول",
        type: "Stationery",
        lat: 30.9265,
        lng: 29.6322,
      },
      {
        id: SEED_DATA.VENDORS.MAZAARE_AL_KHEIR,
        user_id: SEED_DATA.USERS.MAZAARE_AL_KHEIR,
        shop_name: "مزارع الخير",
        address: "الحي الأول",
        type: "VegFruit",
        lat: 30.9272,
        lng: 29.6335,
      },
    ];

    for (const v of vendors) {
      await connection.execute(
        "INSERT IGNORE INTO vendors (id, user_id, shop_name, shop_description, phone, address, type, status, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          v.id,
          v.user_id,
          v.shop_name,
          `${v.shop_name} - ${v.address}`,
          "+20100000000",
          v.address,
          v.type,
          ShopStatus.OPEN,
          v.lat,
          v.lng,
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
