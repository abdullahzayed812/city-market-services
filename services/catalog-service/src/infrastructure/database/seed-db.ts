import { SEED_DATA, CategoryType, MeasurementType, WeightUnit } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { randomUUID } from "crypto";
import { ProductFactory } from "./factories/product.factory";
import { ProductSeeder } from "./seeders/product.seeder";

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

const seedDb = async () => {
  const db = Database.getInstance({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });
  const connection = db.getPool();
  const conn = await connection.getConnection();

  try {
    console.log("Starting catalog seeding...");

    // 1. Create Global Categories
    const ROASTERY_CAT = randomUUID();
    const STATIONERY_CAT = randomUUID();
    const VEG_FRUIT_CAT = randomUUID();
    const SNACKS_CAT = randomUUID();

    const globalCategories = [
      {
        id: SEED_DATA.CATEGORIES.DAIRY,
        name: "الألبان",
        description: "الحليب ومنتجات الألبان",
        color: "#3B82F6",
        key: "DAIRY",
      },
      {
        id: SEED_DATA.CATEGORIES.GROCERY,
        name: "البقالة",
        description: "المواد الغذائية الجافة",
        color: "#F59E0B",
        key: "GROCERY",
      },
      {
        id: SEED_DATA.CATEGORIES.DRINKS,
        name: "المشروبات",
        description: "المشروبات بأنواعها",
        color: "#06B6D4",
        key: "DRINKS",
      },
      {
        id: SEED_DATA.CATEGORIES.BAKERY,
        name: "المخبوزات",
        description: "منتجات المخبز",
        color: "#D97706",
        key: "BAKERY",
      },
      {
        id: SEED_DATA.CATEGORIES.CLEANING,
        name: "المنظفات",
        description: "مستلزمات التنظيف",
        color: "#10B981",
        key: "CLEANING",
      },
      {
        id: SEED_DATA.CATEGORIES.PHARMACY_OTC,
        name: "الصيدلية",
        description: "أدوية ومستلزمات طبية",
        color: "#EF4444",
        key: "PERSONAL_CARE",
      },
      { id: SEED_DATA.CATEGORIES.MEAT, name: "اللحوم", description: "لحوم طازجة", color: "#B91C1C", key: "MEAT" },
      {
        id: SEED_DATA.CATEGORIES.POULTRY,
        name: "الدواجن",
        description: "دواجن طازجة",
        color: "#F97316",
        key: "POULTRY",
      },
      { id: SEED_DATA.CATEGORIES.FISH, name: "الأسماك", description: "أسماك طازجة", color: "#0EA5E9", key: "FISH" },
      { id: ROASTERY_CAT, name: "تسالي ومحامص", description: "لب وبن", color: "#78350F", key: "SNACKS" },
      { id: STATIONERY_CAT, name: "أدوات مكتبية", description: "مستلزمات مكتبية", color: "#6366F1", key: "STATIONERY" },
      { id: VEG_FRUIT_CAT, name: "خضروات وفاكهة", description: "خضروات وفاكهة", color: "#22C55E", key: "VEG_FRUIT" },
      { id: SNACKS_CAT, name: "سناكس", description: "سناكس وحلويات", color: "#A855F7", key: "SNACKS" },
    ];

    const globalCategoryMap: Record<string, string> = {};
    for (const cat of globalCategories) {
      await conn.execute("INSERT IGNORE INTO categories (id, name, type, description, color) VALUES (?, ?, ?, ?, ?)", [
        cat.id,
        cat.name,
        CategoryType.GLOBAL,
        cat.description,
        cat.color,
      ]);
      globalCategoryMap[cat.key] = cat.id;
    }

    // 2. Define Vendor Categories
    const vendorGroups = [
      {
        ids: [SEED_DATA.VENDORS.SUPER_MARKET_1, SEED_DATA.VENDORS.SUPER_MARKET_2, VENDOR_IDS.SANAQREH],
        cats: ["بقالة", "ألبان", "منظفات", "مشروبات", "سناكس"],
        globalMappings: {
          GROCERY: "بقالة",
          DAIRY: "ألبان",
          CLEANING: "منظفات",
          DRINKS: "مشروبات",
          SNACKS: "سناكس",
        },
      },
      {
        ids: [SEED_DATA.VENDORS.PHARMACY, VENDOR_IDS.AHMED_YEHIA, VENDOR_IDS.SABAWI],
        cats: ["أدوية", "عناية شخصية"],
        globalMappings: { PERSONAL_CARE: "عناية شخصية" }, // PHARMACY_OTC isn't in global mapping explicitly, we will use PERSONAL_CARE
      },
      {
        ids: [SEED_DATA.VENDORS.BUTCHER, VENDOR_IDS.ABDULLAH_BUTCHER],
        cats: ["لحوم طازجة"],
        globalMappings: { MEAT: "لحوم طازجة" },
      },
      {
        ids: [SEED_DATA.VENDORS.POULTRY, VENDOR_IDS.BEHEIRY_POULTRY],
        cats: ["دواجن"],
        globalMappings: { POULTRY: "دواجن" },
      },
      {
        ids: [SEED_DATA.VENDORS.FISH, VENDOR_IDS.GHANEM_FISH, VENDOR_IDS.MUTAWAKKIL_FISH, VENDOR_IDS.ABU_YOUSSEF_FISH],
        cats: ["أسماك"],
        globalMappings: { FISH: "أسماك" },
      },
      {
        ids: [VENDOR_IDS.BONDOQA, VENDOR_IDS.ASHRI, VENDOR_IDS.LOZINA],
        cats: ["لب وبن"],
        globalMappings: { SNACKS: "لب وبن" },
      },
      {
        ids: [SEED_DATA.VENDORS.BAKERY, VENDOR_IDS.AL_BARAKA_BAKERY],
        cats: ["خبز طازج", "حلويات"],
        globalMappings: { BAKERY: "خبز طازج" },
      },
      {
        ids: [VENDOR_IDS.ABU_OMAR, VENDOR_IDS.RAWAN],
        cats: ["حلويات شرقية"],
        globalMappings: { BAKERY: "حلويات شرقية" },
      },
      {
        ids: [VENDOR_IDS.SHADY_LIBRARY],
        cats: ["أدوات مكتبية"],
        globalMappings: { STATIONERY: "أدوات مكتبية" },
      },
      {
        ids: [VENDOR_IDS.AWLAD_RAGAB, VENDOR_IDS.MAZAARE_AL_KHEIR],
        cats: ["خضروات", "فاكهة"],
        globalMappings: { VEG_FRUIT: "خضروات" },
      },
    ];

    const vendorCatMap: Record<string, Record<string, string>> = {};
    const ALL_VENDOR_IDS: string[] = [];
    const vendorAssignmentsByGlobalKey: Record<string, { vendorId: string; vendorCategoryId: string }[]> = {};

    for (const group of vendorGroups) {
      for (const vId of group.ids) {
        ALL_VENDOR_IDS.push(vId);
        vendorCatMap[vId] = {};
        for (const catName of group.cats) {
          const catId = randomUUID();
          await conn.execute("INSERT IGNORE INTO categories (id, name, type, vendor_id) VALUES (?, ?, ?, ?)", [
            catId,
            catName,
            CategoryType.VENDOR,
            vId,
          ]);
          vendorCatMap[vId][catName] = catId;
        }

        if (group.globalMappings) {
          for (const [globalKey, vendorCatName] of Object.entries(group.globalMappings)) {
            if (!vendorAssignmentsByGlobalKey[globalKey]) {
              vendorAssignmentsByGlobalKey[globalKey] = [];
            }
            vendorAssignmentsByGlobalKey[globalKey].push({
              vendorId: vId,
              vendorCategoryId: vendorCatMap[vId][vendorCatName],
            });
          }
        }
      }
    }

    const assignmentRules: Record<string, { vendorId: string; vendorCategoryId: string }[]> = {};
    for (const [key, assignments] of Object.entries(vendorAssignmentsByGlobalKey)) {
      const gCatId = globalCategoryMap[key];
      if (gCatId) {
        assignmentRules[gCatId] = assignments;
      }
    }

    // 3. Programmatic Product Generation
    console.log("Generating 1000 products...");
    const globalProducts = ProductFactory.generateGlobalProducts(globalCategoryMap, 1000);
    const vendorProducts = ProductFactory.generateVendorProducts(globalProducts, assignmentRules);

    // 4. Seeding with Bulk Inserts
    const seeder = new ProductSeeder(conn);
    await seeder.seedGlobalProducts(globalProducts);
    await seeder.seedVendorProducts(vendorProducts);

    seeder.logSummary(globalProducts, vendorProducts, Object.keys(globalCategoryMap));

    console.log("Catalog seeding complete.");
  } catch (error) {
    console.error("Seeding error:", error);
    throw error;
  } finally {
    conn.release();
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
