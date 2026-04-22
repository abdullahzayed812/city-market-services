import { SEED_DATA, CategoryType } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { randomUUID } from "crypto";
import { ProductFactory } from "./factories/product.factory";
import { ProductSeeder } from "./seeders/product.seeder";

// ─── Fixed UUIDs for categories not in SEED_DATA ─────────────────────────────
const CAT = {
  SNACKS:     "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01",
  ROASTERY:   "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02",
  VEG_FRUIT:  "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03",
  STATIONERY: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04",
  PASTRY:     "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05",
};

// ─── Vendor shorthands ────────────────────────────────────────────────────────
const V = SEED_DATA.VENDORS;

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

    // ── 1. Global Categories ──────────────────────────────────────────────────
    // key must match the keys in product.factory.ts GLOBAL_PRODUCTS
    const globalCategories = [
      {
        id: SEED_DATA.CATEGORIES.DAIRY,
        name: "الألبان ومنتجاتها",
        description: "حليب وجبن وزبادي ومنتجات الألبان",
        color: "#3B82F6",
        key: "DAIRY",
      },
      {
        id: SEED_DATA.CATEGORIES.GROCERY,
        name: "البقالة والمواد الغذائية",
        description: "مواد غذائية جافة ومعلبات وزيوت",
        color: "#F59E0B",
        key: "GROCERY",
      },
      {
        id: SEED_DATA.CATEGORIES.DRINKS,
        name: "المشروبات",
        description: "مياه وعصائر ومشروبات غازية وساخنة",
        color: "#06B6D4",
        key: "DRINKS",
      },
      {
        id: SEED_DATA.CATEGORIES.CLEANING,
        name: "المنظفات ومستلزمات التنظيف",
        description: "منظفات ومطهرات ومستلزمات المنزل",
        color: "#10B981",
        key: "CLEANING",
      },
      {
        id: SEED_DATA.CATEGORIES.PERSONAL_CARE,
        name: "العناية الشخصية والصيدلية",
        description: "عناية بالشعر والبشرة والأسنان وأدوية بدون وصفة",
        color: "#EF4444",
        key: "PERSONAL_CARE",
      },
      {
        id: SEED_DATA.CATEGORIES.MEAT,
        name: "اللحوم الطازجة",
        description: "لحوم بقري وضاني طازجة",
        color: "#B91C1C",
        key: "MEAT",
      },
      {
        id: SEED_DATA.CATEGORIES.POULTRY,
        name: "الدواجن الطازجة",
        description: "دجاج وأجزاء دواجن طازجة",
        color: "#F97316",
        key: "POULTRY",
      },
      {
        id: SEED_DATA.CATEGORIES.FISH,
        name: "الأسماك وثمار البحر",
        description: "أسماك وجمبري وثمار بحر طازجة",
        color: "#0EA5E9",
        key: "FISH",
      },
      {
        id: SEED_DATA.CATEGORIES.BAKERY,
        name: "المخبوزات",
        description: "خبز طازج وتوست وبقسماط",
        color: "#D97706",
        key: "BAKERY",
      },
      {
        id: CAT.PASTRY,
        name: "الحلويات الشرقية",
        description: "بقلاوة وكنافة وحلويات شرقية طازجة",
        color: "#EC4899",
        key: "PASTRY",
      },
      {
        id: CAT.SNACKS,
        name: "سناكس وحلويات مغلفة",
        description: "شيبس وبسكويت وحلويات مغلفة",
        color: "#A855F7",
        key: "SNACKS",
      },
      {
        id: CAT.ROASTERY,
        name: "تسالي ومحامص",
        description: "مكسرات وبذور محمصة وقهوة مطحونة",
        color: "#78350F",
        key: "ROASTERY",
      },
      {
        id: CAT.VEG_FRUIT,
        name: "خضروات وفاكهة طازجة",
        description: "خضروات وفاكهة طازجة موسمية",
        color: "#22C55E",
        key: "VEG_FRUIT",
      },
      {
        id: CAT.STATIONERY,
        name: "أدوات مكتبية ومدرسية",
        description: "أقلام ودفاتر وأدوات مكتبية ومدرسية",
        color: "#6366F1",
        key: "STATIONERY",
      },
    ];

    const globalCategoryMap: Record<string, string> = {};
    for (const cat of globalCategories) {
      await conn.execute(
        "INSERT IGNORE INTO categories (id, name, type, description, color) VALUES (?, ?, ?, ?, ?)",
        [cat.id, cat.name, CategoryType.GLOBAL, cat.description, cat.color],
      );
      globalCategoryMap[cat.key] = cat.id;
    }

    // ── 2. Vendor Groups + Vendor Categories ──────────────────────────────────
    //
    // Each group defines:
    //   ids         — which vendor IDs belong to this group
    //   cats        — the vendor-specific category names to create for each vendor
    //   globalMappings — maps a GLOBAL_PRODUCTS key to the vendor category name
    //                    (controls which global products appear under which vendor category)
    //
    const vendorGroups: {
      ids: string[];
      cats: string[];
      globalMappings: Record<string, string>;
    }[] = [
      {
        // Supermarkets sell dairy, grocery, drinks, cleaning, packaged snacks
        ids: [V.SUPER_MARKET_1, V.SUPER_MARKET_2, V.SANAQREH],
        cats: ["ألبان", "بقالة", "مشروبات", "منظفات", "سناكس"],
        globalMappings: {
          DAIRY:    "ألبان",
          GROCERY:  "بقالة",
          DRINKS:   "مشروبات",
          CLEANING: "منظفات",
          SNACKS:   "سناكس",
        },
      },
      {
        // Pharmacies sell personal care + OTC medicine
        ids: [V.PHARMACY, V.AHMED_YEHIA, V.SABAWI],
        cats: ["عناية شخصية وصيدلية"],
        globalMappings: {
          PERSONAL_CARE: "عناية شخصية وصيدلية",
        },
      },
      {
        // Butchers sell all fresh meat cuts
        ids: [V.BUTCHER, V.ABDULLAH_BUTCHER],
        cats: ["لحوم طازجة"],
        globalMappings: {
          MEAT: "لحوم طازجة",
        },
      },
      {
        // Poultry shops sell chicken and parts
        ids: [V.POULTRY, V.BEHEIRY_POULTRY],
        cats: ["دواجن طازجة"],
        globalMappings: {
          POULTRY: "دواجن طازجة",
        },
      },
      {
        // Fish shops sell all seafood
        ids: [V.FISH, V.GHANEM_FISH, V.MUTAWAKKIL_FISH, V.ABU_YOUSSEF_FISH],
        cats: ["أسماك وثمار بحر"],
        globalMappings: {
          FISH: "أسماك وثمار بحر",
        },
      },
      {
        // Roasteries sell nuts, seeds, ground coffee
        ids: [V.BONDOQA, V.ASHRI, V.LOZINA],
        cats: ["تسالي ومكسرات", "قهوة ومحامص"],
        globalMappings: {
          ROASTERY: "تسالي ومكسرات",
        },
      },
      {
        // Bakeries sell fresh bread
        ids: [V.BAKERY, V.AL_BARAKA_BAKERY],
        cats: ["خبز طازج"],
        globalMappings: {
          BAKERY: "خبز طازج",
        },
      },
      {
        // Pastry shops sell oriental sweets
        ids: [V.ABU_OMAR, V.RAWAN],
        cats: ["حلويات شرقية"],
        globalMappings: {
          PASTRY: "حلويات شرقية",
        },
      },
      {
        // Stationery shops
        ids: [V.SHADY_LIBRARY],
        cats: ["أدوات مكتبية ومدرسية"],
        globalMappings: {
          STATIONERY: "أدوات مكتبية ومدرسية",
        },
      },
      {
        // Veg/fruit shops sell all produce
        ids: [V.AWLAD_RAGAB, V.MAZAARE_AL_KHEIR],
        cats: ["خضروات طازجة", "فاكهة طازجة"],
        globalMappings: {
          VEG_FRUIT: "خضروات طازجة",
        },
      },
    ];

    // Build vendorCatMap: vendorId → { catName → catId }
    const vendorCatMap: Record<string, Record<string, string>> = {};
    // Build vendorAssignmentsByGlobalKey: globalKey → [{ vendorId, vendorCategoryId }]
    const vendorAssignmentsByGlobalKey: Record<string, { vendorId: string; vendorCategoryId: string }[]> = {};

    for (const group of vendorGroups) {
      for (const vendorId of group.ids) {
        vendorCatMap[vendorId] = {};

        for (const catName of group.cats) {
          const catId = randomUUID();
          await conn.execute(
            "INSERT IGNORE INTO categories (id, name, type, vendor_id) VALUES (?, ?, ?, ?)",
            [catId, catName, CategoryType.VENDOR, vendorId],
          );
          vendorCatMap[vendorId][catName] = catId;
        }

        for (const [globalKey, vendorCatName] of Object.entries(group.globalMappings)) {
          if (!vendorAssignmentsByGlobalKey[globalKey]) {
            vendorAssignmentsByGlobalKey[globalKey] = [];
          }
          vendorAssignmentsByGlobalKey[globalKey].push({
            vendorId,
            vendorCategoryId: vendorCatMap[vendorId][vendorCatName],
          });
        }
      }
    }

    // Convert global key → global category ID for the factory
    const assignmentRules: Record<string, { vendorId: string; vendorCategoryId: string }[]> = {};
    for (const [key, assignments] of Object.entries(vendorAssignmentsByGlobalKey)) {
      const gCatId = globalCategoryMap[key];
      if (gCatId) assignmentRules[gCatId] = assignments;
    }

    // ── 3. Generate and seed products ─────────────────────────────────────────
    const globalProducts = ProductFactory.generateGlobalProducts(globalCategoryMap);
    const vendorProducts = ProductFactory.generateVendorProducts(globalProducts, assignmentRules);

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
