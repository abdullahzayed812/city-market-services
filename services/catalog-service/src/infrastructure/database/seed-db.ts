import { SEED_DATA, CategoryType } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { randomUUID } from "crypto";

const getRandomPrice = (min: number, max: number) => Number((Math.random() * (max - min) + min).toFixed(2));
const getRandomStock = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);

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
    console.log("Starting database seeding...");

    // 1. Create Global Categories
    const globalCategories = [
      { id: SEED_DATA.CATEGORIES.DAIRY, name: "الألبان", description: "الحليب ومنتجات الألبان", color: "#3B82F6" },
      { id: SEED_DATA.CATEGORIES.GROCERY, name: "البقالة", description: "المواد الغذائية الجافة", color: "#F59E0B" },
      { id: SEED_DATA.CATEGORIES.DRINKS, name: "المشروبات", description: "المشروبات بأنواعها", color: "#06B6D4" },
      { id: SEED_DATA.CATEGORIES.FROZEN, name: "المجمدات", description: "الأغذية المجمدة", color: "#8B5CF6" },
      { id: SEED_DATA.CATEGORIES.BAKERY, name: "المخبوزات", description: "منتجات المخبز الطازجة", color: "#D97706" },
      { id: SEED_DATA.CATEGORIES.CLEANING, name: "المنظفات", description: "مستلزمات التنظيف", color: "#10B981" },
      { id: SEED_DATA.CATEGORIES.PERSONAL_CARE, name: "العناية شخصية", description: "منتجات النظافة الشخصية", color: "#EC4899" },
    ];

    for (const cat of globalCategories) {
      await connection.execute(
        "INSERT IGNORE INTO categories (id, name, type, vendor_id, description, color) VALUES (?, ?, ?, NULL, ?, ?)",
        [cat.id, cat.name, CategoryType.GLOBAL, cat.description, cat.color]
      );
    }

    // 2. Define Vendor Categories
    const vendorsWithCats = [
      { id: SEED_DATA.VENDORS.SUPER_MARKET_1, cats: ["أجبان طازجة", "عصائر ومشروبات", "أدوات نظافة"] },
      { id: SEED_DATA.VENDORS.SUPER_MARKET_2, cats: ["بقوليات ومعلبات", "دواجن مجمدة", "زيوت ودهون"] },
      { id: SEED_DATA.VENDORS.BAKERY, cats: ["خبز يومي", "معجنات شرقية", "كيك وحلويات"] },
      { id: SEED_DATA.VENDORS.PHARMACY, cats: ["أدوية ومسكنات", "عناية بالبشرة", "إسعافات أولية"] },
    ];

    const vendorCatMap: Record<string, Record<string, string>> = {};

    for (const v of vendorsWithCats) {
      vendorCatMap[v.id] = {};
      for (const catName of v.cats) {
        const catId = randomUUID();
        await connection.execute(
          "INSERT IGNORE INTO categories (id, name, type, vendor_id) VALUES (?, ?, ?, ?)",
          [catId, catName, CategoryType.VENDOR, v.id]
        );
        vendorCatMap[v.id][catName] = catId;
      }
    }

    // 3. Product Generation Configuration
    const productMap = [
      {
        globalCat: SEED_DATA.CATEGORIES.DAIRY,
        vendor: SEED_DATA.VENDORS.SUPER_MARKET_1,
        vendorCatName: "أجبان طازجة",
        items: ["حليب كامل الدسم", "زبادي سادة", "جبنة بيضاء", "قشطة بلدي", "زبدة طبيعية", "لبن رايب", "جبنة شيدر", "جبنة مثلثات", "حليب أطفال", "كريمة خفق"],
        priceRange: [5, 100]
      },
      {
        globalCat: SEED_DATA.CATEGORIES.DRINKS,
        vendor: SEED_DATA.VENDORS.SUPER_MARKET_1,
        vendorCatName: "عصائر ومشروبات",
        items: ["مياه معدنية", "عصير برتقال", "مشروب غازي", "شاي أخضر", "قهوة مطحونة", "مشروب طاقة", "عصير تفاح", "مياه فوارة", "حليب بالشوكولاتة", "سحلب"],
        priceRange: [3, 50]
      },
      {
        globalCat: SEED_DATA.CATEGORIES.GROCERY,
        vendor: SEED_DATA.VENDORS.SUPER_MARKET_2,
        vendorCatName: "بقوليات ومعلبات",
        items: ["أرز مصري", "معكرونة قلم", "سكر ناعم", "عدس أصفر", "فاصوليا بيضاء", "فول مدمس", "صلصة طماطم", "تونه قطعة واحدة", "ملح طعام", "خل أبيض", "دقيق فاخر", "حلاوة طحينية", "مربى فراولة", "عسل نحل"],
        priceRange: [10, 80]
      },
      {
        globalCat: SEED_DATA.CATEGORIES.FROZEN,
        vendor: SEED_DATA.VENDORS.SUPER_MARKET_2,
        vendorCatName: "دواجن مجمدة",
        items: ["دجاج كامل مجمد", "صدور دجاج", "أوراك دجاج", "برجر بقري", "سجق شرقي", "كفتة داوود باشا", "ناجتس دجاج", "بطاطس نصف مقلية", "بازلاء وجزر مجمدة", "ملوخية مجمدة"],
        priceRange: [30, 250]
      },
      {
        globalCat: SEED_DATA.CATEGORIES.BAKERY,
        vendor: SEED_DATA.VENDORS.BAKERY,
        vendorCatName: "خبز يومي",
        items: ["عيش بلدي", "عيش فينو", "توست أبيض", "قرص سادة", "بقسماط مطحون", "باتيه بالجبنة", "كرواسون زبدة", "توست أسمر", "خبز نخالة", "كايزر"],
        priceRange: [2, 30]
      },
      {
        globalCat: SEED_DATA.CATEGORIES.BAKERY,
        vendor: SEED_DATA.VENDORS.BAKERY,
        vendorCatName: "معجنات شرقية",
        items: ["بسبوسة سادة", "كنافة بالكريمة", "جلاش بالمكسرات", "بلح الشام", "زلابية", "بقلاوة", "رموش الست", "مشكل حلويات", "قطايف"],
        priceRange: [40, 300]
      },
      {
        globalCat: SEED_DATA.CATEGORIES.CLEANING,
        vendor: SEED_DATA.VENDORS.SUPER_MARKET_1,
        vendorCatName: "أدوات نظافة",
        items: ["مسحوق غسيل أوتوماتيك", "سائل جلي صحون", "منظف أرضيات", "كلور تبييض", "مناديل مطبخ", "معطر جو", "سلك مواعين", "إسفنجة تنظيف", "أكياس قمامة", "منظف زجاج"],
        priceRange: [10, 150]
      },
      {
        globalCat: SEED_DATA.CATEGORIES.PERSONAL_CARE,
        vendor: SEED_DATA.VENDORS.PHARMACY,
        vendorCatName: "عناية بالبشرة",
        items: ["شامبو للشعر", "بلسم مرطب", "صابون طبيعي", "معجون أسنان", "فرشاة أسنان", "غسول للوجه", "مزيل عرق", "كريم ترطيب", "واقي شمس", "شاور جيل"],
        priceRange: [15, 400]
      }
    ];

    // Multiply generation to get ~100+ items
    for (const section of productMap) {
      const vendorCatId = vendorCatMap[section.vendor][section.vendorCatName];
      
      for (const item of section.items) {
        await connection.execute(
          "INSERT IGNORE INTO products (id, vendor_id, global_category_id, vendor_category_id, name, description, price, stock_quantity, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            randomUUID(),
            section.vendor,
            section.globalCat,
            vendorCatId,
            item,
            `${item} - جودة عالية من متجرنا`,
            getRandomPrice(section.priceRange[0], section.priceRange[1]),
            getRandomStock(10, 200),
            true
          ]
        );
      }
    }

    console.log("Seeding complete: Global Categories, Vendor Categories, and 100+ Products created.");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedDb();
