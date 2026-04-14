import { randomUUID } from "crypto";
import { MeasurementType, WeightUnit } from "@city-market/shared";
import { ProductGenerationHelper, BRANDS } from "../helpers/product-generation.helper";

export interface GlobalProductSeed {
  id: string;
  name: string;
  description: string;
  global_category_id: string;
  measurement_type: MeasurementType;
  weight_unit: WeightUnit | null;
}

export interface VendorProductSeed {
  id: string;
  vendor_id: string;
  global_product_id: string;
  vendor_category_id: string;
  price: number;
  stock_quantity: number;
  stock_weight_grams: number;
  is_available: boolean;
}

const BASE_PRODUCTS: Record<string, { ar: string; en: string; measure: MeasurementType }[]> = {
  DAIRY: [
    { ar: "حليب", en: "Milk", measure: MeasurementType.UNIT },
    { ar: "زبادي", en: "Yogurt", measure: MeasurementType.UNIT },
    { ar: "لبن رايب", en: "Rayeb Milk", measure: MeasurementType.UNIT },
    { ar: "قشطة", en: "Cream", measure: MeasurementType.UNIT },
    { ar: "زبدة", en: "Butter", measure: MeasurementType.UNIT },
    { ar: "جبنة بيضاء", en: "White Cheese", measure: MeasurementType.UNIT },
    { ar: "جبنة رومي", en: "Roumy Cheese", measure: MeasurementType.WEIGHT },
    { ar: "جبنة فلمنك", en: "Flamenco Cheese", measure: MeasurementType.WEIGHT },
  ],
  DRINKS: [
    { ar: "مياه معدنية", en: "Mineral Water", measure: MeasurementType.UNIT },
    { ar: "عصير برتقال", en: "Orange Juice", measure: MeasurementType.UNIT },
    { ar: "عصير تفاح", en: "Apple Juice", measure: MeasurementType.UNIT },
    { ar: "مشروب غازي", en: "Soda", measure: MeasurementType.UNIT },
    { ar: "شاي", en: "Tea", measure: MeasurementType.UNIT },
    { ar: "قهوة", en: "Coffee", measure: MeasurementType.UNIT },
    { ar: "مشروب طاقة", en: "Energy Drink", measure: MeasurementType.UNIT },
  ],
  GROCERY: [
    { ar: "أرز مصري", en: "Egyptian Rice", measure: MeasurementType.WEIGHT },
    { ar: "مكرونة قلم", en: "Penne Pasta", measure: MeasurementType.UNIT },
    { ar: "سكر", en: "Sugar", measure: MeasurementType.WEIGHT },
    { ar: "زيت عباد شمس", en: "Sunflower Oil", measure: MeasurementType.UNIT },
    { ar: "سمن نباتي", en: "Vegetable Ghee", measure: MeasurementType.UNIT },
    { ar: "صلصة طماطم", en: "Tomato Paste", measure: MeasurementType.UNIT },
    { ar: "دقيق فاخر", en: "Fine Flour", measure: MeasurementType.WEIGHT },
    { ar: "عدس أصفر", en: "Yellow Lentils", measure: MeasurementType.WEIGHT },
    { ar: "فول مدمس", en: "Fava Beans", measure: MeasurementType.UNIT },
    { ar: "تونه قطعة واحدة", en: "Tuna Chunks", measure: MeasurementType.UNIT },
  ],
  CLEANING: [
    { ar: "مسحوق غسيل", en: "Laundry Powder", measure: MeasurementType.UNIT },
    { ar: "صابون سائل للأطباق", en: "Dish Soap", measure: MeasurementType.UNIT },
    { ar: "منظف أرضيات", en: "Floor Cleaner", measure: MeasurementType.UNIT },
    { ar: "كلور مطهر", en: "Chlorine Disinfectant", measure: MeasurementType.UNIT },
    { ar: "مناديل تواليت", en: "Toilet Tissues", measure: MeasurementType.UNIT },
    { ar: "معطر جو", en: "Air Freshener", measure: MeasurementType.UNIT },
  ],
  PERSONAL_CARE: [
    { ar: "شامبو", en: "Shampoo", measure: MeasurementType.UNIT },
    { ar: "بلسم شعر", en: "Hair Conditioner", measure: MeasurementType.UNIT },
    { ar: "صابون استحمام", en: "Bath Soap", measure: MeasurementType.UNIT },
    { ar: "معجون أسنان", en: "Toothpaste", measure: MeasurementType.UNIT },
    { ar: "مزيل عرق", en: "Deodorant", measure: MeasurementType.UNIT },
    { ar: "فرشاة أسنان", en: "Toothbrush", measure: MeasurementType.UNIT },
  ],
  SNACKS: [
    { ar: "شيبس بطاطس", en: "Potato Chips", measure: MeasurementType.UNIT },
    { ar: "بسكويت سادة", en: "Plain Biscuits", measure: MeasurementType.UNIT },
    { ar: "كيك شوكولاتة", en: "Chocolate Cake", measure: MeasurementType.UNIT },
    { ar: "شوكولاتة بالحليب", en: "Milk Chocolate", measure: MeasurementType.UNIT },
    { ar: "كرواسون جبنة", en: "Cheese Croissant", measure: MeasurementType.UNIT },
    { ar: "لب سوبر", en: "Super Sunflower Seeds", measure: MeasurementType.WEIGHT },
  ],
  MEAT: [
    { ar: "لحم بقري موزة", en: "Beef Shank", measure: MeasurementType.WEIGHT },
    { ar: "مفروم بقري", en: "Minced Beef", measure: MeasurementType.WEIGHT },
    { ar: "كبدة بقري", en: "Beef Liver", measure: MeasurementType.WEIGHT },
    { ar: "سجق بلدي", en: "Baladi Sausage", measure: MeasurementType.WEIGHT },
    { ar: "كفتة حياتي", en: "Kofta", measure: MeasurementType.WEIGHT },
    { ar: "لحم ضاني", en: "Lamb Meat", measure: MeasurementType.WEIGHT },
  ],
  POULTRY: [
    { ar: "فراخ بيضاء كاملة", en: "Whole White Chicken", measure: MeasurementType.WEIGHT },
    { ar: "بانية دجاج", en: "Chicken Paneer", measure: MeasurementType.WEIGHT },
    { ar: "شيش طاووق", en: "Shish Tawook", measure: MeasurementType.WEIGHT },
    { ar: "أوراك دجاج", en: "Chicken Thighs", measure: MeasurementType.WEIGHT },
    { ar: "دبابيس دجاج", en: "Chicken Drumsticks", measure: MeasurementType.WEIGHT },
    { ar: "كبد وقوانص", en: "Gizzard & Liver", measure: MeasurementType.WEIGHT },
  ],
  VEG_FRUIT: [
    { ar: "طماطم", en: "Tomatoes", measure: MeasurementType.WEIGHT },
    { ar: "خيار", en: "Cucumber", measure: MeasurementType.WEIGHT },
    { ar: "بطاطس تحمير", en: "Frying Potatoes", measure: MeasurementType.WEIGHT },
    { ar: "بصل أحمر", en: "Red Onion", measure: MeasurementType.WEIGHT },
    { ar: "تفاح أحمر", en: "Red Apple", measure: MeasurementType.WEIGHT },
    { ar: "موز بلدي", en: "Baladi Banana", measure: MeasurementType.WEIGHT },
    { ar: "برتقال عصير", en: "Juice Orange", measure: MeasurementType.WEIGHT },
    { ar: "فراولة", en: "Strawberry", measure: MeasurementType.WEIGHT },
  ],
  BAKERY: [
    { ar: "عيش بلدي", en: "Baladi Bread", measure: MeasurementType.UNIT },
    { ar: "عيش فينو", en: "Fino Bread", measure: MeasurementType.UNIT },
    { ar: "بقسماط مطحون", en: "Breadcrumbs", measure: MeasurementType.UNIT },
    { ar: "قرص سادة", en: "Plain Pastry", measure: MeasurementType.UNIT },
    { ar: "توست أبيض", en: "White Toast", measure: MeasurementType.UNIT },
  ],
  FISH: [
    { ar: "سمك بلطي", en: "Tilapia Fish", measure: MeasurementType.WEIGHT },
    { ar: "سمك بوري", en: "Mullet Fish", measure: MeasurementType.WEIGHT },
    { ar: "جمبري وسط", en: "Medium Shrimp", measure: MeasurementType.WEIGHT },
    { ar: "سبيط", en: "Calamari", measure: MeasurementType.WEIGHT },
  ],
  STATIONERY: [
    { ar: "كشكول سلك", en: "Wire Notebook", measure: MeasurementType.UNIT },
    { ar: "قلم جاف", en: "Ballpoint Pen", measure: MeasurementType.UNIT },
    { ar: "ألوان خشب", en: "Colored Pencils", measure: MeasurementType.UNIT },
    { ar: "براية", en: "Sharpener", measure: MeasurementType.UNIT },
  ],
};

export class ProductFactory {
  static generateGlobalProducts(categoryMap: Record<string, string>, targetCount: number = 5000): GlobalProductSeed[] {
    const products: GlobalProductSeed[] = [];
    const usedNames = new Set<string>();

    const categories = Object.keys(BASE_PRODUCTS);
    let count = 0;

    while (count < targetCount) {
      if (count % 500 === 0 && count > 0) {
        console.log(`Generated ${count} / ${targetCount} unique products...`);
      }

      const categoryKey = ProductGenerationHelper.getRandomItem(categories);
      const categoryId = categoryMap[categoryKey];
      const baseProducts = BASE_PRODUCTS[categoryKey];

      if (!categoryId || !baseProducts || baseProducts.length === 0) continue;

      const baseProduct = ProductGenerationHelper.getRandomItem(baseProducts);
      const brand = ProductGenerationHelper.getRandomItem(BRANDS[categoryKey as keyof typeof BRANDS] || ["محلي"]);

      const variations = ProductGenerationHelper.generateVariations(baseProduct.ar, baseProduct.en, brand, categoryKey);

      for (const variation of variations) {
        const sku = Math.floor(Math.random() * 90000) + 10000;
        const uniqueKey = `${variation.nameAr}_${categoryId}_${sku}`;
        if (usedNames.has(uniqueKey)) continue;

        products.push({
          id: randomUUID(),
          name: `${variation.nameAr}`,
          description: `وصف منتج ${variation.nameAr} - ${variation.nameEn} - SKU: ${sku}`,
          global_category_id: categoryId,
          measurement_type: baseProduct.measure,
          weight_unit: variation.weightUnit || (baseProduct.measure === MeasurementType.WEIGHT ? WeightUnit.KG : null),
        });

        usedNames.add(uniqueKey);
        count++;

        if (count >= targetCount) break;
      }
    }

    return products;
  }

  static generateVendorProducts(
    globalProducts: GlobalProductSeed[],
    assignmentRules: Record<string, { vendorId: string; vendorCategoryId: string }[]>,
  ): VendorProductSeed[] {
    const vendorProducts: VendorProductSeed[] = [];

    for (const gp of globalProducts) {
      // Find allowed vendors for this global product's category
      const allowedAssignments = assignmentRules[gp.global_category_id] || [];
      if (allowedAssignments.length === 0) continue;

      // Pick 1-3 vendors from the ALLOWED list
      const numVendors = Math.min(Math.floor(Math.random() * 3) + 1, allowedAssignments.length);
      const shuffledAssignments = [...allowedAssignments].sort(() => 0.5 - Math.random());
      const selectedAssignments = shuffledAssignments.slice(0, numVendors);

      for (const assignment of selectedAssignments) {
        const isWeight = gp.measurement_type === MeasurementType.WEIGHT;

        vendorProducts.push({
          id: randomUUID(),
          vendor_id: assignment.vendorId,
          global_product_id: gp.id,
          vendor_category_id: assignment.vendorCategoryId,
          price: Number((Math.random() * 490 + 10).toFixed(2)),
          stock_quantity: isWeight ? 0 : Math.floor(Math.random() * 100) + 10,
          stock_weight_grams: isWeight ? Math.floor(Math.random() * 50000) + 5000 : 0,
          is_available: true,
        });
      }
    }

    return vendorProducts;
  }
}
