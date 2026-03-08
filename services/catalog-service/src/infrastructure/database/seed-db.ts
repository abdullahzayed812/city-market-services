import { SEED_DATA, CategoryType, MeasurementType, WeightUnit } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { randomUUID } from "crypto";

const VENDOR_IDS = {
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

const getRandomPrice = (min: number, max: number) => {
  const rawPrice = Math.random() * (max - min) + min;
  return Number((Math.round(rawPrice * 4) / 4).toFixed(2));
};
const getRandomStock = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);
const getRandomWeightStock = (minKg: number, maxKg: number) => Math.floor((Math.random() * (maxKg - minKg) + minKg) * 1000);

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
    console.log("Starting catalog seeding...");

    // 1. Create Global Categories
    const ROASTERY_CAT = randomUUID();
    const STATIONERY_CAT = randomUUID();
    const VEG_FRUIT_CAT = randomUUID();

    const globalCategories = [
      { id: SEED_DATA.CATEGORIES.DAIRY, name: "الألبان", description: "الحليب ومنتجات الألبان", color: "#3B82F6" },
      { id: SEED_DATA.CATEGORIES.GROCERY, name: "البقالة", description: "المواد الغذائية الجافة", color: "#F59E0B" },
      { id: SEED_DATA.CATEGORIES.DRINKS, name: "المشروبات", description: "المشروبات بأنواعها", color: "#06B6D4" },
      { id: SEED_DATA.CATEGORIES.BAKERY, name: "المخبوزات", description: "منتجات المخبز", color: "#D97706" },
      { id: SEED_DATA.CATEGORIES.CLEANING, name: "المنظفات", description: "مستلزمات التنظيف", color: "#10B981" },
      { id: SEED_DATA.CATEGORIES.PHARMACY_OTC, name: "الصيدلية", description: "أدوية ومستلزمات طبية", color: "#EF4444" },
      { id: SEED_DATA.CATEGORIES.MEAT, name: "اللحوم", description: "لحوم طازجة", color: "#B91C1C" },
      { id: SEED_DATA.CATEGORIES.POULTRY, name: "الدواجن", description: "دواجن طازجة", color: "#F97316" },
      { id: SEED_DATA.CATEGORIES.FISH, name: "الأسماك", description: "أسماك طازجة", color: "#0EA5E9" },
      { id: ROASTERY_CAT, name: "تسالي ومحامص", description: "لب وبن", color: "#78350F" },
      { id: STATIONERY_CAT, name: "أدوات مكتبية", description: "مستلزمات مكتبية", color: "#6366F1" },
      { id: VEG_FRUIT_CAT, name: "خضروات وفاكهة", description: "خضروات وفاكهة", color: "#22C55E" },
    ];

    for (const cat of globalCategories) {
      await connection.execute(
        "INSERT IGNORE INTO categories (id, name, type, description, color) VALUES (?, ?, ?, ?, ?)",
        [cat.id, cat.name, CategoryType.GLOBAL, cat.description, cat.color]
      );
    }

    // 2. Define Vendor Categories
    const vendorGroups = [
      { ids: [SEED_DATA.VENDORS.SUPER_MARKET_1, SEED_DATA.VENDORS.SUPER_MARKET_2, VENDOR_IDS.SANAQREH], cats: ["بقالة", "ألبان", "منظفات", "مشروبات"] },
      { ids: [SEED_DATA.VENDORS.PHARMACY, VENDOR_IDS.AHMED_YEHIA, VENDOR_IDS.SABAWI], cats: ["أدوية", "عناية شخصية"] },
      { ids: [SEED_DATA.VENDORS.BUTCHER, VENDOR_IDS.ABDULLAH_BUTCHER], cats: ["لحوم طازجة"] },
      { ids: [SEED_DATA.VENDORS.POULTRY, VENDOR_IDS.BEHEIRY_POULTRY], cats: ["دواجن"] },
      { ids: [SEED_DATA.VENDORS.FISH, VENDOR_IDS.GHANEM_FISH, VENDOR_IDS.MUTAWAKKIL_FISH, VENDOR_IDS.ABU_YOUSSEF_FISH], cats: ["أسماك"] },
      { ids: [VENDOR_IDS.BONDOQA, VENDOR_IDS.ASHRI, VENDOR_IDS.LOZINA], cats: ["لب وبن"] },
      { ids: [SEED_DATA.VENDORS.BAKERY, VENDOR_IDS.AL_BARAKA_BAKERY], cats: ["خبز طازج", "حلويات"] },
      { ids: [VENDOR_IDS.ABU_OMAR, VENDOR_IDS.RAWAN], cats: ["حلويات شرقية"] },
      { ids: [VENDOR_IDS.SHADY_LIBRARY], cats: ["أدوات مكتبية"] },
      { ids: [VENDOR_IDS.AWLAD_RAGAB, VENDOR_IDS.MAZAARE_AL_KHEIR], cats: ["خضروات", "فاكهة"] },
    ];

    const vendorCatMap: Record<string, Record<string, string>> = {};

    for (const group of vendorGroups) {
      for (const vId of group.ids) {
        vendorCatMap[vId] = {};
        for (const catName of group.cats) {
          const catId = randomUUID();
          await connection.execute("INSERT IGNORE INTO categories (id, name, type, vendor_id) VALUES (?, ?, ?, ?)", [
            catId, catName, CategoryType.VENDOR, vId
          ]);
          vendorCatMap[vId][catName] = catId;
        }
      }
    }

    // 3. Product Generation (With Weight Support)
    const productMap = [
      { globalCat: SEED_DATA.CATEGORIES.DAIRY, measureType: MeasurementType.UNIT, vendors: [SEED_DATA.VENDORS.SUPER_MARKET_1, SEED_DATA.VENDORS.SUPER_MARKET_2, VENDOR_IDS.SANAQREH], vCat: "ألبان", items: ["حليب جهينة", "زبادي المراعي", "جبنة بيضاء", "قشطة", "زبدة", "لبن رايب"] },
      { globalCat: SEED_DATA.CATEGORIES.GROCERY, measureType: MeasurementType.UNIT, vendors: [SEED_DATA.VENDORS.SUPER_MARKET_1, SEED_DATA.VENDORS.SUPER_MARKET_2, VENDOR_IDS.SANAQREH], vCat: "بقالة", items: ["أرز", "مكرونة", "سكر", "عدس أصفر", "فاصوليا بيضاء", "فول مدمس", "صلصة طماطم", "تونه", "ملح", "خل", "دقيق", "حلاوة طحينية"] },
      { globalCat: SEED_DATA.CATEGORIES.DRINKS, measureType: MeasurementType.UNIT, vendors: [SEED_DATA.VENDORS.SUPER_MARKET_1, SEED_DATA.VENDORS.SUPER_MARKET_2, VENDOR_IDS.SANAQREH], vCat: "مشروبات", items: ["مياه سيوة", "عصير جهينة برتقال", "بيبسي", "شاي ليبتون", "نسكافيه", "ريد بول"] },
      { globalCat: SEED_DATA.CATEGORIES.CLEANING, measureType: MeasurementType.UNIT, vendors: [SEED_DATA.VENDORS.SUPER_MARKET_1, SEED_DATA.VENDORS.SUPER_MARKET_2, VENDOR_IDS.SANAQREH], vCat: "منظفات", items: ["تايد أوتوماتيك", "فيري ليمون", "ديتول أرضيات", "كلور", "مناديل مطبخ", "معطر جو"] },
      { globalCat: SEED_DATA.CATEGORIES.PHARMACY_OTC, measureType: MeasurementType.UNIT, vendors: [SEED_DATA.VENDORS.PHARMACY, VENDOR_IDS.AHMED_YEHIA, VENDOR_IDS.SABAWI], vCat: "أدوية", items: ["بنادول اكسترا", "بروفين", "كتافلام", "كومتركس", "فيتامين سي فوار", "أسبيرين"] },
      
      { globalCat: SEED_DATA.CATEGORIES.MEAT, measureType: MeasurementType.WEIGHT, vendors: [SEED_DATA.VENDORS.BUTCHER, VENDOR_IDS.ABDULLAH_BUTCHER], vCat: "لحوم طازجة", items: ["لحم بقري", "لحم ضاني", "كبدة بقري", "مفروم بقري", "سجق بلدي", "كفتة حياتي"] },
      { globalCat: SEED_DATA.CATEGORIES.POULTRY, measureType: MeasurementType.WEIGHT, vendors: [SEED_DATA.VENDORS.POULTRY, VENDOR_IDS.BEHEIRY_POULTRY], vCat: "دواجن", items: ["فراخ بيضاء", "فراخ بلدي", "بانية", "شيش طاووق", "أوراك فراخ", "كبد وقوانص"] },
      { globalCat: SEED_DATA.CATEGORIES.FISH, measureType: MeasurementType.WEIGHT, vendors: [SEED_DATA.VENDORS.FISH, VENDOR_IDS.GHANEM_FISH, VENDOR_IDS.MUTAWAKKIL_FISH, VENDOR_IDS.ABU_YOUSSEF_FISH], vCat: "أسماك", items: ["سمك بلطي", "سمك بوري", "جمبري", "سبيط", "سمك ماكريل", "سمك فيليه"] },
      
      { globalCat: ROASTERY_CAT, measureType: MeasurementType.WEIGHT, vendors: [VENDOR_IDS.BONDOQA, VENDOR_IDS.ASHRI, VENDOR_IDS.LOZINA], vCat: "لب وبن", items: ["لب سوبر", "لب عباد", "فول سوداني", "بن فاتح", "بن محوج", "مكسرات مشكلة"] },
      { globalCat: SEED_DATA.CATEGORIES.BAKERY, measureType: MeasurementType.UNIT, vendors: [SEED_DATA.VENDORS.BAKERY, VENDOR_IDS.AL_BARAKA_BAKERY], vCat: "خبز طازج", items: ["عيش بلدي", "عيش فينو", "بقسماط", "قرص سادة", "باتيه جبنة", "توست أبيض"] },
      { globalCat: SEED_DATA.CATEGORIES.BAKERY, measureType: MeasurementType.UNIT, vendors: [VENDOR_IDS.ABU_OMAR, VENDOR_IDS.RAWAN], vCat: "حلويات شرقية", items: ["بسبوسة سادة", "كنافة بالكريمة", "بقلاوة مكسرات", "تورتة شوكولاتة", "بلح الشام"] },
      { globalCat: STATIONERY_CAT, measureType: MeasurementType.UNIT, vendors: [VENDOR_IDS.SHADY_LIBRARY], vCat: "أدوات مكتبية", items: ["كشكول سلك", "قلم جاف أزرق", "مقلمة", "ألوان خشب", "براية", "أستيكة"] },
      
      { globalCat: VEG_FRUIT_CAT, measureType: MeasurementType.WEIGHT, vendors: [VENDOR_IDS.AWLAD_RAGAB, VENDOR_IDS.MAZAARE_AL_KHEIR], vCat: "خضروات", items: ["طماطم", "خيار", "بطاطس", "بصل", "فلفل رومي", "باذنجان"] },
      { globalCat: VEG_FRUIT_CAT, measureType: MeasurementType.WEIGHT, vendors: [VENDOR_IDS.AWLAD_RAGAB, VENDOR_IDS.MAZAARE_AL_KHEIR], vCat: "فاكهة", items: ["تفاح أحمر", "موز", "برتقال بلدي", "فراولة", "جوافة"] },
    ];

    for (const section of productMap) {
      for (const vId of section.vendors) {
        const vCatId = vendorCatMap[vId][section.vCat] || Object.values(vendorCatMap[vId])[0];
        for (const name of section.items) {
          const globalId = randomUUID();
          await connection.execute(
            "INSERT IGNORE INTO global_products (id, name, global_category_id, measurement_type, weight_unit) VALUES (?, ?, ?, ?, ?)", 
            [globalId, name, section.globalCat, section.measureType, section.measureType === MeasurementType.WEIGHT ? WeightUnit.KG : null]
          );
          
          if (section.measureType === MeasurementType.UNIT) {
            await connection.execute(
              "INSERT IGNORE INTO vendor_products (id, vendor_id, global_product_id, vendor_category_id, price, stock_quantity, stock_weight_grams, measurement_type, weight_unit, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
              [randomUUID(), vId, globalId, vCatId, getRandomPrice(10, 500), getRandomStock(10, 100), 0, section.measureType, null, true]
            );
          } else {
            await connection.execute(
              "INSERT IGNORE INTO vendor_products (id, vendor_id, global_product_id, vendor_category_id, price, stock_quantity, stock_weight_grams, measurement_type, weight_unit, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
              [randomUUID(), vId, globalId, vCatId, getRandomPrice(10, 500), 0, getRandomWeightStock(20, 200), section.measureType, WeightUnit.KG, true]
            );
          }
        }
      }
    }

    console.log("Catalog seeding complete.");
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedDb();
