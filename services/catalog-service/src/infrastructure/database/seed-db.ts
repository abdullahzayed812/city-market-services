import { SEED_DATA, CategoryType } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { createHash } from "crypto";
import { ProductFactory } from "./factories/product.factory";
import { ProductSeeder } from "./seeders/product.seeder";

function deterministicUUID(input: string): string {
  const hash = createHash("sha256").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// ─── Fixed UUIDs for categories not in SEED_DATA.CATEGORIES ──────────────────
const CAT = {
  SNACKS: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01",
  ROASTERY: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02",
  VEG_FRUIT: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03",
  STATIONERY: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04",
  PASTRY: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05",
  CANNED: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b09",
  TEA_COFFEE: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b10",
  PAPER: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11",
  PET: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12",
  KITCHEN: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13",
  HOUSEHOLD: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14",
  BEAUTY: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b15",
  // The following are also in SEED_DATA.CATEGORIES:
  FROZEN: SEED_DATA.CATEGORIES.FROZEN,
  EGGS: SEED_DATA.CATEGORIES.EGGS,
  SPICES: SEED_DATA.CATEGORIES.SPICES,
  BABY: SEED_DATA.CATEGORIES.BABY,
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
    // Names are SHORT (1-3 words) for mobile UI.
    // key must match the keys in product.factory.ts GLOBAL_PRODUCTS.
    const globalCategories = [
      {
        id: SEED_DATA.CATEGORIES.DAIRY,
        name: "ألبان",
        description: "حليب وجبن وزبادي ومنتجات الألبان",
        color: "#3B82F6",
        key: "DAIRY",
      },
      {
        id: SEED_DATA.CATEGORIES.GROCERY,
        name: "بقالة",
        description: "مواد غذائية جافة ومعلبات وزيوت وأساسيات المطبخ",
        color: "#F59E0B",
        key: "GROCERY",
      },
      {
        id: SEED_DATA.CATEGORIES.DRINKS,
        name: "مشروبات",
        description: "مياه وعصائر ومشروبات غازية وساخنة",
        color: "#06B6D4",
        key: "DRINKS",
      },

      {
        id: SEED_DATA.CATEGORIES.CLEANING,
        name: "منظفات",
        description: "منظفات ومطهرات ومستلزمات المنزل",
        color: "#10B981",
        key: "CLEANING",
      },
      {
        id: SEED_DATA.CATEGORIES.PERSONAL_CARE,
        name: "عناية شخصية",
        description: "صابون ومعجون أسنان وأدوات حلاقة ومستلزمات نظافة وأدوية بدون وصفة",
        color: "#EF4444",
        key: "PERSONAL_CARE",
      },
      {
        id: CAT.BEAUTY,
        name: "عناية بالجمال",
        description: "شامبو وبلسم وكريمات ترطيب وواقي شمس ومستحضرات تجميل",
        color: "#F43F5E",
        key: "BEAUTY",
      },
      // {
      //   id: CAT.BABY,
      //   name: "مستلزمات أطفال",
      //   description: "حفاضات وحليب أطفال ومستلزمات العناية بالرضع",
      //   color: "#FCA5A5",
      //   key: "BABY",
      // },
      {
        id: SEED_DATA.CATEGORIES.MEAT,
        name: "لحوم",
        description: "لحوم بقري وضاني طازجة",
        color: "#B91C1C",
        key: "MEAT",
      },
      {
        id: SEED_DATA.CATEGORIES.POULTRY,
        name: "دواجن",
        description: "دجاج وأجزاء دواجن وديك رومي وبط",
        color: "#F97316",
        key: "POULTRY",
      },
      {
        id: SEED_DATA.CATEGORIES.FISH,
        name: "أسماك",
        description: "أسماك وجمبري وثمار بحر وأسماك مملحة",
        color: "#0EA5E9",
        key: "FISH",
      },
      {
        id: SEED_DATA.CATEGORIES.BAKERY,
        name: "مخبوزات",
        description: "خبز طازج وتوست وفطائر ومخبوزات",
        color: "#D97706",
        key: "BAKERY",
      },
      {
        id: CAT.PASTRY,
        name: "حلويات",
        description: "بقلاوة وكنافة وحلويات شرقية طازجة",
        color: "#EC4899",
        key: "PASTRY",
      },
      {
        id: CAT.VEG_FRUIT,
        name: "خضار وفاكهة",
        description: "خضروات وفاكهة طازجة موسمية",
        color: "#22C55E",
        key: "VEG_FRUIT",
      },
      {
        id: CAT.FROZEN,
        name: "مجمدات",
        description: "خضروات ودجاج وأسماك وأطعمة مجمدة",
        color: "#BAE6FD",
        key: "FROZEN",
      },
      {
        id: CAT.STATIONERY,
        name: "أدوات مكتبية",
        description: "أقلام ودفاتر وأدوات مكتبية ومدرسية",
        color: "#6366F1",
        key: "STATIONERY",
      },
      // {
      //   id: CAT.CANNED,
      //   name: "معلبات وصوصات",
      //   description: "معلبات وصوصات وكاتشب ومايونيز ومرقة جاهزة",
      //   color: "#DC2626",
      //   key: "CANNED",
      // },
      // {
      //   id: CAT.TEA_COFFEE,
      //   name: "شاي وقهوة",
      //   description: "شاي وقهوة ومشروبات عشبية ساخنة",
      //   color: "#65A30D",
      //   key: "TEA_COFFEE",
      // },
      // {
      //   id: CAT.PAPER,
      //   name: "ورقيات",
      //   description: "مناديل ورقية وتواليت وفوط مطبخ",
      //   color: "#94A3B8",
      //   key: "PAPER",
      // },
      // {
      //   id: CAT.PET,
      //   name: "مستلزمات الحيوانات الأليفة",
      //   description: "طعام القطط والكلاب ورمل القطط ومستلزمات الطيور",
      //   color: "#F472B6",
      //   key: "PET",
      // },
      // {
      //   id: CAT.KITCHEN,
      //   name: "أدوات المطبخ",
      //   description: "أدوات تغليف ومستلزمات مطبخ للاستخدام مرة واحدة",
      //   color: "#0D9488",
      //   key: "KITCHEN",
      // },
      // {
      //   id: CAT.HOUSEHOLD,
      //   name: "أدوات منزلية متنوعة",
      //   description: "بطاريات ولمبات إضاءة ومستلزمات منزلية متنوعة",
      //   color: "#71717A",
      //   key: "HOUSEHOLD",
      // },
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

    // ── 2. Vendor Groups + Vendor Categories ──────────────────────────────────
    //
    // Each group defines:
    //   ids            — vendor IDs in this group
    //   cats           — vendor-specific category names (created per vendor)
    //   globalMappings — globalProductKey → vendorCategoryName
    //                    (controls which global products appear under which vendor cat)
    //
    const vendorGroups: {
      ids: string[];
      cats: string[];
      globalMappings: Record<string, string>;
    }[] = [
      {
        // Supermarkets: broad, simplified aisle structure (5 sections) that groups
        // every global category a supermarket carries — food, drinks, home care,
        // personal care, and beauty — instead of one vendor category per global category.
        ids: [V.SUPER_MARKET_1, V.SUPER_MARKET_2, V.SANAQREH],
        cats: ["الأغذية", "المشروبات", "العناية المنزلية", "العناية الشخصية", "العناية بالجمال"],
        globalMappings: {
          // الأغذية: everything edible/pantry — dairy, grocery, snacks, eggs, spices, frozen, canned, tea/coffee
          DAIRY: "الأغذية",
          GROCERY: "الأغذية",
          SNACKS: "الأغذية",
          EGGS: "الأغذية",
          SPICES: "الأغذية",
          FROZEN: "الأغذية",
          CANNED: "الأغذية",
          TEA_COFFEE: "الأغذية",
          // المشروبات: water, juices, sodas, hot drinks
          DRINKS: "المشروبات",
          // العناية المنزلية: cleaning, paper products, pet supplies, kitchen disposables, misc household
          CLEANING: "العناية المنزلية",
          PAPER: "العناية المنزلية",
          PET: "العناية المنزلية",
          KITCHEN: "العناية المنزلية",
          HOUSEHOLD: "العناية المنزلية",
          // العناية الشخصية: hygiene & health — soap, toothpaste, shaving, OTC medicine
          PERSONAL_CARE: "العناية الشخصية",
          // العناية بالجمال: shampoo, skincare, sun protection, cosmetics
          BEAUTY: "العناية بالجمال",
        },
      },
      {
        // Pharmacies: personal care, OTC medicine, baby care
        ids: [V.PHARMACY, V.AHMED_YEHIA, V.SABAWI],
        cats: ["عناية شخصية", "أدوية بدون وصفة", "فيتامينات ومكملات", "منتجات أطفال"],
        globalMappings: {
          PERSONAL_CARE: "عناية شخصية",
          BABY: "منتجات أطفال",
        },
      },
      {
        // Butchers: all beef and lamb cuts
        ids: [V.BUTCHER, V.ABDULLAH_BUTCHER],
        cats: ["لحم بقري", "لحم ضاني", "مشتقات اللحوم"],
        globalMappings: {
          MEAT: "لحم بقري",
        },
      },
      {
        // Poultry shops
        ids: [V.POULTRY, V.BEHEIRY_POULTRY],
        cats: ["دجاج طازج", "أجزاء الدجاج", "دواجن متنوعة", "بيض طازج"],
        globalMappings: {
          POULTRY: "دجاج طازج",
          EGGS: "بيض طازج",
        },
      },
      {
        // Fish shops (Alexandria specialty: includes salted/cured fish)
        ids: [V.FISH, V.GHANEM_FISH, V.MUTAWAKKIL_FISH, V.ABU_YOUSSEF_FISH],
        cats: ["أسماك طازجة", "مأكولات بحرية", "أسماك مملحة وفسيخ"],
        globalMappings: {
          FISH: "أسماك طازجة",
        },
      },
      {
        // Roasteries: nuts, dried fruits, ground coffee, herbs/spices
        ids: [V.BONDOQA, V.ASHRI, V.LOZINA],
        cats: ["مكسرات ولب", "فواكه مجففة", "قهوة ومحامص", "بهارات وأعشاب"],
        globalMappings: {
          ROASTERY: "مكسرات ولب",
          SPICES: "بهارات وأعشاب",
        },
      },
      {
        // Bakeries
        ids: [V.BAKERY, V.AL_BARAKA_BAKERY],
        cats: ["عيش طازج", "فطائر وكعك"],
        globalMappings: {
          BAKERY: "عيش طازج",
        },
      },
      {
        // Pastry shops
        ids: [V.ABU_OMAR, V.RAWAN],
        cats: ["حلويات شرقية", "مخبوزات حلوة"],
        globalMappings: {
          PASTRY: "حلويات شرقية",
        },
      },
      {
        // Stationery shops
        ids: [V.SHADY_LIBRARY],
        cats: ["أدوات مكتبية", "أدوات مدرسية"],
        globalMappings: {
          STATIONERY: "أدوات مكتبية",
        },
      },
      {
        // Veg & fruit shops: produce, herbs, and eggs (sold alongside veg)
        ids: [V.AWLAD_RAGAB, V.MAZAARE_AL_KHEIR],
        cats: ["خضروات طازجة", "فاكهة طازجة"],
        globalMappings: {
          VEG_FRUIT: "خضروات طازجة",
          EGGS: "بيض بلدي",
          SPICES: "أعشاب طازجة",
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
          const catId = deterministicUUID(`cat:${vendorId}:${catName}`);
          await conn.execute("INSERT IGNORE INTO categories (id, name, type, vendor_id) VALUES (?, ?, ?, ?)", [catId, catName, CategoryType.VENDOR, vendorId]);
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
    // const globalProducts = ProductFactory.generateGlobalProducts(globalCategoryMap);
    // // Reverse map: globalCategoryId → categoryKey (for realistic per-category pricing)
    // const categoryKeyById = Object.fromEntries(
    //   Object.entries(globalCategoryMap).map(([key, id]) => [id, key]),
    // );
    // const vendorProducts = ProductFactory.generateVendorProducts(globalProducts, assignmentRules, categoryKeyById);

    // const seeder = new ProductSeeder(conn);
    // await seeder.seedGlobalProducts(globalProducts);
    // await seeder.seedVendorProducts(vendorProducts);

    // seeder.logSummary(globalProducts, vendorProducts, Object.keys(globalCategoryMap));

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
