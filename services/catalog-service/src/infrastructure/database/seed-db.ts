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
        "Full Cream Milk 1L",
        "Low Fat Milk 1L",
        "Baby Milk Small",
        "Plain Yogurt",
        "Fruit Yogurt",
        "White Cheese",
        "Cheddar Cheese",
        "Triangle Cheese",
        "Cream",
        "Butter",
        "Ghee",
        "Laban Rayeb",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.GROCERY,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_2,
      priceRange: [5, 150],
      items: [
        "Rice 1KG",
        "Rice 5KG",
        "Pasta 400g",
        "Pasta 1KG",
        "Sugar 1KG",
        "Oil 1L",
        "Oil 2L",
        "Salt",
        "Flour",
        "Tomato Sauce",
        "Tuna",
        "Fava Beans",
        "Lentils",
        "Beans",
        "Chickpeas",
        "Tea",
        "Coffee",
        "Instant Coffee",
        "Plain Biscuits",
        "Cream Biscuits",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.DRINKS,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_1,
      priceRange: [5, 40],
      items: [
        "Water 1.5L",
        "Water Small Pack",
        "Juice Box",
        "Juice 1L",
        "Soda 1L",
        "Soda 2L",
        "Chocolate Milk",
        "Energy Drink",
        "Iced Tea",
        "Sparkling Water",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.FROZEN,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_2,
      priceRange: [30, 200],
      items: [
        "Frozen Chicken",
        "Burger",
        "Sausage",
        "Peas & Carrots",
        "Frozen Fries",
        "Samosa",
        "Kofta",
        "Frozen Fish",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.CLEANING,
      vendor: SEED_DATA.VENDORS.SUPER_MARKET_1,
      priceRange: [10, 120],
      items: [
        "Laundry Powder",
        "Automatic Laundry Powder",
        "Dishwashing Liquid",
        "Chlorine",
        "Floor Cleaner",
        "Tissues",
        "Kitchen Towels",
        "Garbage Bags",
        "Sponge",
        "Foil",
        "Stretch Wrap",
        "Air Freshener",
        "Dish Soap",
        "Stain Remover",
        "Hand Sanitizer",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.PERSONAL_CARE,
      vendor: SEED_DATA.VENDORS.PHARMACY,
      priceRange: [15, 250],
      items: [
        "Shampoo",
        "Conditioner",
        "Soap",
        "Face Wash",
        "Toothpaste",
        "Toothbrush",
        "Deodorant",
        "Hair Cream",
        "Moisturizer",
        "Razor",
        "Sanitary Pads",
        "Baby Diapers",
        "Wet Wipes",
        "Adult Diapers",
        "Hand Wash",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.PHARMACY_OTC,
      vendor: SEED_DATA.VENDORS.PHARMACY,
      priceRange: [10, 180],
      items: [
        "Pain Relief",
        "Fever Reducer",
        "Cold Medicine",
        "Vitamin C",
        "Multivitamin",
        "Burn Cream",
        "Allergy Cream",
        "Nasal Spray",
        "Cough Syrup",
        "Thermometer",
      ],
    },
    {
      category: SEED_DATA.CATEGORIES.BAKERY,
      vendor: SEED_DATA.VENDORS.BAKERY,
      priceRange: [2, 50],
      items: [
        "Baladi Bread",
        "Fino Bread",
        "White Toast",
        "Brown Toast",
        "Croissant",
        "Feteer",
        "Bread Crumbs",
        "Cheese Pate",
        "Chocolate Pate",
        "Kahk",
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
      { id: SEED_DATA.CATEGORIES.DAIRY, name: "Dairy", description: "Milk & dairy products" },
      { id: SEED_DATA.CATEGORIES.GROCERY, name: "Grocery", description: "Dry grocery items" },
      { id: SEED_DATA.CATEGORIES.DRINKS, name: "Drinks", description: "Beverages" },
      { id: SEED_DATA.CATEGORIES.FROZEN, name: "Frozen", description: "Frozen food items" },
      { id: SEED_DATA.CATEGORIES.CLEANING, name: "Cleaning", description: "Cleaning supplies" },
      { id: SEED_DATA.CATEGORIES.PERSONAL_CARE, name: "Personal Care", description: "Personal hygiene products" },
      { id: SEED_DATA.CATEGORIES.PHARMACY_OTC, name: "Pharmacy OTC", description: "Over the counter medicine" },
      { id: SEED_DATA.CATEGORIES.BAKERY, name: "Bakery", description: "Fresh bakery products" },
    ];

    for (const cat of categories) {
      await connection.execute("INSERT IGNORE INTO categories (id, name, description) VALUES (?, ?, ?)", [
        cat.id,
        cat.name,
        cat.description,
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
        ]
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
