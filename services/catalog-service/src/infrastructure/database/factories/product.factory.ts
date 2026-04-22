import { randomUUID } from "crypto";
import { MeasurementType, WeightUnit } from "@city-market/shared";

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

// ─────────────────────────────────────────────────────────────────────────────
//  Fixed global product catalog — no brands, no redundant size variations.
//  Each entry represents one distinct product in the Egyptian market.
//  Weight products → 100 kg initial stock.
//  Unit products  → 100 units initial stock.
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_PRODUCTS: Record<string, { name: string; measure: MeasurementType }[]> = {

  DAIRY: [
    { name: "حليب طازج كامل الدسم",       measure: MeasurementType.UNIT },
    { name: "حليب نصف دسم",               measure: MeasurementType.UNIT },
    { name: "حليب خالي الدسم",            measure: MeasurementType.UNIT },
    { name: "زبادي طبيعي",                measure: MeasurementType.UNIT },
    { name: "لبن رايب",                    measure: MeasurementType.UNIT },
    { name: "قشطة طازجة",                 measure: MeasurementType.UNIT },
    { name: "زبدة بلدية",                 measure: MeasurementType.UNIT },
    { name: "جبنة بيضاء قريش",            measure: MeasurementType.WEIGHT },
    { name: "جبنة رومي",                  measure: MeasurementType.WEIGHT },
    { name: "جبنة فلمنك",                 measure: MeasurementType.WEIGHT },
    { name: "جبنة كريم",                  measure: MeasurementType.UNIT },
    { name: "جبنة مثلثات",               measure: MeasurementType.UNIT },
    { name: "عيران",                       measure: MeasurementType.UNIT },
  ],

  DRINKS: [
    { name: "مياه معدنية",                 measure: MeasurementType.UNIT },
    { name: "عصير برتقال طبيعي",           measure: MeasurementType.UNIT },
    { name: "عصير مانجو",                  measure: MeasurementType.UNIT },
    { name: "عصير تفاح",                   measure: MeasurementType.UNIT },
    { name: "عصير جوافة",                  measure: MeasurementType.UNIT },
    { name: "عصير فراولة",                 measure: MeasurementType.UNIT },
    { name: "مشروب كولا",                  measure: MeasurementType.UNIT },
    { name: "مشروب ليمون غازي",            measure: MeasurementType.UNIT },
    { name: "مشروب تفاح غازي",             measure: MeasurementType.UNIT },
    { name: "شاي أكياس",                   measure: MeasurementType.UNIT },
    { name: "نسكافيه سريع التحضير",        measure: MeasurementType.UNIT },
    { name: "مشروب طاقة",                  measure: MeasurementType.UNIT },
  ],

  GROCERY: [
    { name: "أرز مصري",                    measure: MeasurementType.WEIGHT },
    { name: "أرز بسمتي",                   measure: MeasurementType.WEIGHT },
    { name: "سكر ناعم",                    measure: MeasurementType.WEIGHT },
    { name: "دقيق أبيض",                   measure: MeasurementType.WEIGHT },
    { name: "عدس أصفر",                    measure: MeasurementType.WEIGHT },
    { name: "عدس أحمر",                    measure: MeasurementType.WEIGHT },
    { name: "فول مجفف",                    measure: MeasurementType.WEIGHT },
    { name: "مكرونة سباغيتي",              measure: MeasurementType.UNIT },
    { name: "مكرونة قلم",                  measure: MeasurementType.UNIT },
    { name: "مكرونة فرخة",                 measure: MeasurementType.UNIT },
    { name: "زيت ذرة",                     measure: MeasurementType.UNIT },
    { name: "زيت زيتون بكر",               measure: MeasurementType.UNIT },
    { name: "سمن نباتي",                   measure: MeasurementType.UNIT },
    { name: "صلصة طماطم معلبة",            measure: MeasurementType.UNIT },
    { name: "تونة في الزيت",               measure: MeasurementType.UNIT },
    { name: "فول معلب",                    measure: MeasurementType.UNIT },
    { name: "بازلاء معلبة",               measure: MeasurementType.UNIT },
    { name: "ملح طعام",                    measure: MeasurementType.UNIT },
    { name: "خل أبيض",                    measure: MeasurementType.UNIT },
    { name: "عسل نحل طبيعي",              measure: MeasurementType.UNIT },
  ],

  CLEANING: [
    { name: "مسحوق غسيل",                 measure: MeasurementType.UNIT },
    { name: "سائل غسيل ملابس",            measure: MeasurementType.UNIT },
    { name: "صابون سائل للأطباق",         measure: MeasurementType.UNIT },
    { name: "منظف أرضيات",                measure: MeasurementType.UNIT },
    { name: "كلور مطهر",                  measure: MeasurementType.UNIT },
    { name: "مناديل تواليت",              measure: MeasurementType.UNIT },
    { name: "مناديل ورقية",               measure: MeasurementType.UNIT },
    { name: "معطر جو",                    measure: MeasurementType.UNIT },
    { name: "مبيد حشرات",                 measure: MeasurementType.UNIT },
    { name: "كيس قمامة",                  measure: MeasurementType.UNIT },
    { name: "إسفنجة جلي",                measure: MeasurementType.UNIT },
  ],

  // Pharmacies and personal care shops
  PERSONAL_CARE: [
    { name: "شامبو للشعر العادي",          measure: MeasurementType.UNIT },
    { name: "شامبو للشعر الجاف",           measure: MeasurementType.UNIT },
    { name: "بلسم شعر",                    measure: MeasurementType.UNIT },
    { name: "صابون استحمام",               measure: MeasurementType.UNIT },
    { name: "جل استحمام",                  measure: MeasurementType.UNIT },
    { name: "معجون أسنان",                 measure: MeasurementType.UNIT },
    { name: "فرشاة أسنان",                 measure: MeasurementType.UNIT },
    { name: "مزيل عرق رول",               measure: MeasurementType.UNIT },
    { name: "مزيل عرق بخاخ",              measure: MeasurementType.UNIT },
    { name: "كريم ترطيب للبشرة",           measure: MeasurementType.UNIT },
    { name: "غسول وجه",                    measure: MeasurementType.UNIT },
    { name: "قطن طبي",                     measure: MeasurementType.UNIT },
    { name: "ضمادات طبية",                 measure: MeasurementType.UNIT },
    { name: "مسكن ألم أقراص",              measure: MeasurementType.UNIT },
    { name: "فيتامين سي أقراص",           measure: MeasurementType.UNIT },
  ],

  // Packaged snacks — sold in supermarkets
  SNACKS: [
    { name: "شيبس بطاطس",                  measure: MeasurementType.UNIT },
    { name: "شيبس جبنة",                   measure: MeasurementType.UNIT },
    { name: "بسكويت سادة",                 measure: MeasurementType.UNIT },
    { name: "بسكويت شوكولاتة",             measure: MeasurementType.UNIT },
    { name: "ويفر شوكولاتة",               measure: MeasurementType.UNIT },
    { name: "كيك شوكولاتة",                measure: MeasurementType.UNIT },
    { name: "حلاوة طحينية",               measure: MeasurementType.WEIGHT },
    { name: "تمر مجدول",                   measure: MeasurementType.WEIGHT },
    { name: "جيلي ملون",                   measure: MeasurementType.UNIT },
    { name: "حلويات صابلية",               measure: MeasurementType.UNIT },
  ],

  // Loose nuts, seeds, roasted items — sold in roasteries (محامص)
  ROASTERY: [
    { name: "لب سوبر محمص",               measure: MeasurementType.WEIGHT },
    { name: "لب أبيض بلدي",               measure: MeasurementType.WEIGHT },
    { name: "فستق حلبي محمص",             measure: MeasurementType.WEIGHT },
    { name: "لوز محمص",                   measure: MeasurementType.WEIGHT },
    { name: "فول سوداني محمص",            measure: MeasurementType.WEIGHT },
    { name: "كاجو محمص",                  measure: MeasurementType.WEIGHT },
    { name: "بندق محمص",                  measure: MeasurementType.WEIGHT },
    { name: "عين جمل",                    measure: MeasurementType.WEIGHT },
    { name: "بسلة مقلية",                 measure: MeasurementType.WEIGHT },
    { name: "قهوة عربية مطحونة",          measure: MeasurementType.WEIGHT },
    { name: "قهوة تركية مطحونة",          measure: MeasurementType.WEIGHT },
    { name: "قهوة سادة مطحونة",           measure: MeasurementType.WEIGHT },
  ],

  MEAT: [
    { name: "لحم بقري موزة",              measure: MeasurementType.WEIGHT },
    { name: "لحم بقري مفروم",             measure: MeasurementType.WEIGHT },
    { name: "لحم بقري كتف",               measure: MeasurementType.WEIGHT },
    { name: "لحم بقري ريش",               measure: MeasurementType.WEIGHT },
    { name: "كبدة بقري",                  measure: MeasurementType.WEIGHT },
    { name: "لسان بقري",                  measure: MeasurementType.WEIGHT },
    { name: "لحم ضاني مشكل",             measure: MeasurementType.WEIGHT },
    { name: "لحم ضاني مفروم",            measure: MeasurementType.WEIGHT },
    { name: "ضلوع ضاني",                  measure: MeasurementType.WEIGHT },
    { name: "سجق بلدي",                   measure: MeasurementType.WEIGHT },
    { name: "كفتة طازجة",                 measure: MeasurementType.WEIGHT },
  ],

  POULTRY: [
    { name: "فراخ بيضاء كاملة",           measure: MeasurementType.WEIGHT },
    { name: "صدور دجاج",                  measure: MeasurementType.WEIGHT },
    { name: "أوراك دجاج",                 measure: MeasurementType.WEIGHT },
    { name: "دبابيس دجاج",                measure: MeasurementType.WEIGHT },
    { name: "أجنحة دجاج",                 measure: MeasurementType.WEIGHT },
    { name: "كبد وقوانص دجاج",            measure: MeasurementType.WEIGHT },
    { name: "شيش طاووق طازج",            measure: MeasurementType.WEIGHT },
    { name: "مفروم دجاج",                 measure: MeasurementType.WEIGHT },
    { name: "دجاج بلدي كامل",             measure: MeasurementType.WEIGHT },
  ],

  VEG_FRUIT: [
    // Vegetables
    { name: "طماطم",                       measure: MeasurementType.WEIGHT },
    { name: "خيار بلدي",                   measure: MeasurementType.WEIGHT },
    { name: "بطاطس",                       measure: MeasurementType.WEIGHT },
    { name: "بصل أحمر",                    measure: MeasurementType.WEIGHT },
    { name: "ثوم بلدي",                    measure: MeasurementType.WEIGHT },
    { name: "جزر",                         measure: MeasurementType.WEIGHT },
    { name: "كوسة",                        measure: MeasurementType.WEIGHT },
    { name: "فلفل أخضر",                   measure: MeasurementType.WEIGHT },
    { name: "فلفل رومي أحمر",              measure: MeasurementType.WEIGHT },
    { name: "ملوخية طازجة",               measure: MeasurementType.WEIGHT },
    { name: "كراث",                        measure: MeasurementType.WEIGHT },
    { name: "سبانخ",                       measure: MeasurementType.WEIGHT },
    { name: "خس أخضر",                    measure: MeasurementType.WEIGHT },
    // Fruits
    { name: "موز",                         measure: MeasurementType.WEIGHT },
    { name: "برتقال",                      measure: MeasurementType.WEIGHT },
    { name: "تفاح أحمر",                   measure: MeasurementType.WEIGHT },
    { name: "عنب أحمر",                    measure: MeasurementType.WEIGHT },
    { name: "فراولة",                      measure: MeasurementType.WEIGHT },
    { name: "مانجو",                       measure: MeasurementType.WEIGHT },
    { name: "بطيخ",                        measure: MeasurementType.WEIGHT },
    { name: "جوافة",                       measure: MeasurementType.WEIGHT },
    { name: "خوخ",                         measure: MeasurementType.WEIGHT },
    { name: "كمثرى",                       measure: MeasurementType.WEIGHT },
  ],

  // Fresh bread — sold in bakeries (مخابز)
  BAKERY: [
    { name: "عيش بلدي",                    measure: MeasurementType.UNIT },
    { name: "عيش فينو",                    measure: MeasurementType.UNIT },
    { name: "توست أبيض",                   measure: MeasurementType.UNIT },
    { name: "توست أسمر",                   measure: MeasurementType.UNIT },
    { name: "خبز صاج",                     measure: MeasurementType.UNIT },
    { name: "بقسماط مطحون",               measure: MeasurementType.UNIT },
  ],

  // Oriental sweets — sold in pastry shops (حلوانيات)
  PASTRY: [
    { name: "بقلاوة",                      measure: MeasurementType.WEIGHT },
    { name: "كنافة طازجة",                 measure: MeasurementType.WEIGHT },
    { name: "بسبوسة",                      measure: MeasurementType.WEIGHT },
    { name: "قطايف",                       measure: MeasurementType.WEIGHT },
    { name: "حلاوة الشعيبية",             measure: MeasurementType.WEIGHT },
    { name: "مبروم",                       measure: MeasurementType.WEIGHT },
    { name: "لقيمات",                      measure: MeasurementType.UNIT },
    { name: "عوامة",                       measure: MeasurementType.UNIT },
    { name: "مهلبية",                      measure: MeasurementType.UNIT },
    { name: "أم علي",                      measure: MeasurementType.UNIT },
  ],

  FISH: [
    { name: "سمك بلطي طازج",              measure: MeasurementType.WEIGHT },
    { name: "سمك بوري طازج",              measure: MeasurementType.WEIGHT },
    { name: "سمك دنيس",                   measure: MeasurementType.WEIGHT },
    { name: "سمك قاروص",                  measure: MeasurementType.WEIGHT },
    { name: "سمك موسى",                   measure: MeasurementType.WEIGHT },
    { name: "سمك اسكمبري",               measure: MeasurementType.WEIGHT },
    { name: "جمبري وسط",                  measure: MeasurementType.WEIGHT },
    { name: "جمبري كبير",                 measure: MeasurementType.WEIGHT },
    { name: "سبيط",                        measure: MeasurementType.WEIGHT },
    { name: "أخطبوط",                      measure: MeasurementType.WEIGHT },
    { name: "سلطعون",                      measure: MeasurementType.WEIGHT },
  ],

  STATIONERY: [
    { name: "كشكول سلك A4",               measure: MeasurementType.UNIT },
    { name: "كشكول عادي A5",              measure: MeasurementType.UNIT },
    { name: "دفتر مذكرات",                measure: MeasurementType.UNIT },
    { name: "قلم جاف أزرق",               measure: MeasurementType.UNIT },
    { name: "قلم جاف أحمر",               measure: MeasurementType.UNIT },
    { name: "قلم رصاص HB",               measure: MeasurementType.UNIT },
    { name: "أقلام ملونة خشب 12 لون",     measure: MeasurementType.UNIT },
    { name: "أقلام فلوماستر 12 لون",      measure: MeasurementType.UNIT },
    { name: "براية معدنية",               measure: MeasurementType.UNIT },
    { name: "ممحاة بيضاء",               measure: MeasurementType.UNIT },
    { name: "مسطرة 30 سم",               measure: MeasurementType.UNIT },
    { name: "ورق A4 رزمة 500 ورقة",       measure: MeasurementType.UNIT },
    { name: "مقص مكتبي",                  measure: MeasurementType.UNIT },
    { name: "دباسة مكتبية",               measure: MeasurementType.UNIT },
  ],
};

export class ProductFactory {
  static generateGlobalProducts(categoryMap: Record<string, string>): GlobalProductSeed[] {
    const products: GlobalProductSeed[] = [];

    for (const [categoryKey, productList] of Object.entries(GLOBAL_PRODUCTS)) {
      const categoryId = categoryMap[categoryKey];
      if (!categoryId) continue;

      for (const product of productList) {
        const isWeight = product.measure === MeasurementType.WEIGHT;
        products.push({
          id: randomUUID(),
          name: product.name,
          description: product.name,
          global_category_id: categoryId,
          measurement_type: product.measure,
          weight_unit: isWeight ? WeightUnit.KG : null,
        });
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
      const allowedAssignments = assignmentRules[gp.global_category_id] || [];
      if (allowedAssignments.length === 0) continue;

      // Assign to 1–3 vendors from the allowed set, randomly
      const numVendors = Math.min(Math.floor(Math.random() * 3) + 1, allowedAssignments.length);
      const selectedAssignments = [...allowedAssignments]
        .sort(() => 0.5 - Math.random())
        .slice(0, numVendors);

      for (const assignment of selectedAssignments) {
        const isWeight = gp.measurement_type === MeasurementType.WEIGHT;
        vendorProducts.push({
          id: randomUUID(),
          vendor_id: assignment.vendorId,
          global_product_id: gp.id,
          vendor_category_id: assignment.vendorCategoryId,
          price: Number((Math.random() * 490 + 10).toFixed(2)),
          stock_quantity: isWeight ? 0 : 100,
          stock_weight_grams: isWeight ? 100_000 : 0,  // 100 kg
          is_available: true,
        });
      }
    }

    return vendorProducts;
  }
}
