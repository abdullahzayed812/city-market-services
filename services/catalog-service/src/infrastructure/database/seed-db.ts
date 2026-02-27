import { SEED_DATA } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import { randomUUID } from "crypto";

// ================= PRODUCT GENERATOR =================

const getRandomPrice = (min: number, max: number) => Number((Math.random() * (max - min) + min).toFixed(2));

const getRandomStock = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);

const generateProducts = () => {
  const products: any[] = [];

  const productMap = [
    {
      category: SEED_DATA.CATEGORIES.DAIRY,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_1,
      priceRange: [5, 120],
      items: [
        "حليب كامل الدسم 1 لتر",
        "حليب قليل الدسم 1 لتر",
        "حليب أطفال صغير",
        "زبادي سادة",
        "زبادي بالفاكهة",
        "جبنة بيضاء",
        "جبنة شيدر",
        "جبنة مثلثات",
        "قشطة",
        "زبدة",
        "سمن",
        "لبن رايب",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.GROCERY,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_2,
      priceRange: [5, 150],
      items: [
        "أرز 1 كيلو",
        "أرز 5 كيلو",
        "معكرونة 400 جرام",
        "معكرونة 1 كيلو",
        "سكر 1 كيلو",
        "زيت 1 لتر",
        "زيت 2 لتر",
        "ملح",
        "دقيق",
        "صلصة طماطم",
        "تونة",
        "فول",
        "عدس",
        "فاصوليا",
        "حمص",
        "شاي",
        "قهوة",
        "قهوة سريعة التحضير",
        "بسكويت سادة",
        "بسكويت بالكريمة",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.DRINKS,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_1,
      priceRange: [5, 40],
      items: [
        "مياه 1.5 لتر",
        "مياه عبوة صغيرة",
        "عصير كرتون",
        "عصير 1 لتر",
        "مشروب غازي 1 لتر",
        "مشروب غازي 2 لتر",
        "حليب بالشوكولاتة",
        "مشروب طاقة",
        "شاي مثلج",
        "مياه فوارة",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.FROZEN,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_2,
      priceRange: [30, 200],
      items: ["دجاج مجمد", "برجر", "سجق", "بازلاء وجزر", "بطاطس مجمدة", "سمبوسة", "كفتة", "سمك مجمد"],
    },
    {
      category: SEED_DATA.CATEGORIES.CLEANING,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_1,
      priceRange: [10, 120],
      items: [
        "مسحوق غسيل",
        "مسحوق غسيل أوتوماتيك",
        "سائل جلي",
        "كلور",
        "منظف أرضيات",
        "مناديل ورقية",
        "مناشف مطبخ",
        "أكياس قمامة",
        "إسفنجة",
        "ورق فويل",
        "ورق تغليف",
        "معطر جو",
        "صابون جلي",
        "مزيل بقع",
        "معقم يدين",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.PERSONAL_CARE,
      vendor: SEED_DATA.VENDORS.PHARMACY,
      priceRange: [15, 250],
      items: [
        "شامبو",
        "بلسم شعر",
        "صابون",
        "غسول وجه",
        "معجون أسنان",
        "فرشاة أسنان",
        "مزيل عرق",
        "كريم شعر",
        "مرطب بشرة",
        "شفرة حلاقة",
        "فوط صحية",
        "حفاضات أطفال",
        "مناديل مبللة",
        "حفاضات للبالغين",
        "صابون سائل لليدين",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.PHARMACY_OTC,
      vendor: SEED_DATA.VENDORS.PHARMACY,
      priceRange: [10, 180],
      items: [
        "مسكن ألم",
        "خافض حرارة",
        "دواء برد",
        "فيتامين سي",
        "فيتامينات متعددة",
        "كريم حروق",
        "كريم حساسية",
        "بخاخ أنف",
        "شراب سعال",
        "ميزان حرارة",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.BAKERY,
      vendor: SEED_DATA.VENDORS.BAKERY,
      priceRange: [2, 50],
      items: [
        "عيش بلدي",
        "عيش فينو",
        "توست أبيض",
        "توست أسمر",
        "كرواسون",
        "فطير",
        "بقسماط",
        "باتيه بالجبنة",
        "باتيه بالشوكولاتة",
        "كحك",
      ],
    },
  ];

  for (const section of productMap) {
    for (const item of section.items) {
      products.push({
        id: randomUUID(),
        vendor_id: section.vendor,
        category_id: section.category,
        name: item,
        description: `${item} - High quality product`,
        price: getRandomPrice(section.priceRange[0], section.priceRange[1]),
        stock_quantity: getRandomStock(50, 300),
        is_available: true,
      });
    }
  }

  return products;
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
    const categories = [
      { id: SEED_DATA.CATEGORIES.DAIRY, name: "ألبان", description: "الحليب ومنتجات الألبان", color: "#3B82F6" },
      { id: SEED_DATA.CATEGORIES.GROCERY, name: "بقالة", description: "المواد الغذائية الجافة", color: "#F59E0B" },
      { id: SEED_DATA.CATEGORIES.DRINKS, name: "مشروبات", description: "المشروبات بأنواعها", color: "#06B6D4" },
      { id: SEED_DATA.CATEGORIES.FROZEN, name: "مجمدات", description: "الأغذية المجمدة", color: "#8B5CF6" },
      { id: SEED_DATA.CATEGORIES.CLEANING, name: "نظافة منزلية", description: "مستلزمات التنظيف", color: "#10B981" },
      {
        id: SEED_DATA.CATEGORIES.PERSONAL_CARE,
        name: "عناية شخصية",
        description: "منتجات النظافة الشخصية",
        color: "#EC4899",
      },
      { id: SEED_DATA.CATEGORIES.PHARMACY_OTC, name: "صيدلية", description: "أدوية بدون وصفة طبية", color: "#EF4444" },
      { id: SEED_DATA.CATEGORIES.BAKERY, name: "مخبوزات", description: "منتجات المخبز الطازجة", color: "#D97706" },
    ];
    for (const cat of categories) {
      await connection.execute("INSERT IGNORE INTO categories (id, name, description, color) VALUES (?, ?, ?, ?)", [
        cat.id,
        cat.name,
        cat.description,
        cat.color,
      ]);
    }

    const products = generateProducts();

    for (const prod of products) {
      await connection.execute(
        "INSERT IGNORE INTO products (id, vendor_id, category_id, name, description, price, stock_quantity, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          prod.id,
          prod.vendor_id,
          prod.category_id,
          prod.name,
          prod.description,
          prod.price,
          prod.stock_quantity,
          prod.is_available,
        ],
      );
    }

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedDb();
