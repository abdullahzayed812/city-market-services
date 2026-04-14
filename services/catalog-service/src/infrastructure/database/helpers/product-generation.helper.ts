import { WeightUnit } from "@city-market/shared";

export interface ProductVariation {
  nameAr: string;
  nameEn: string;
  weight?: number;
  weightUnit?: WeightUnit;
  volume?: string;
  type?: string;
}

export const BRANDS = {
  DAIRY: ["جهينة", "المراعي", "لبنيتا", "دانيت", "نستلة", "قُتيبة", "عبور لاند", "دومتي", "بريزيدن", "طيبة"],
  DRINKS: [
    "بيبسي",
    "كوكاكولا",
    "سينا كولا",
    "سبييرو سباتس",
    "فايتوز",
    "شويبس",
    "راني",
    "جهينة",
    "بيتي",
    "لمار",
    "إيفيان",
    "بركة",
    "صافي",
    "نستلة",
    "ليبوتون",
  ],
  GROCERY: [
    "إيطاليانو",
    "الملكة",
    "ضحى",
    "الرشيدي الميزان",
    "حلواني",
    "شهية",
    "وادي فود",
    "فينوس",
    "زمزم",
    "الأصيل",
    "كنور",
    "فايف مينيتس",
    "هاينز",
    "كريستال",
    "عافية",
  ],
  CLEANING: ["أريال", "برسيل", "تايد", "فيري", "كلوريل", "ديتول", "فيبا", "اوكسي", "باهي", "جنرال"],
  PERSONAL_CARE: ["دوف", "لوكس", "بانتين", "هيد آند شولدرز", "جونسون", "سيجنال", "كلوز أب", "سنسوداين", "ريكسونا"],
  SNACKS: ["شيبسي", "كرانشي", "تويز", "بوريو", "أولكر", "مولتو", "هوهوز", "توداي", "بيسكوي مصر", "كادبوري"],
  MEAT: ["حلواني", "اللحيمي", "أطياب", "المراعي", "كوكي", "فارمز", "روستي"],
  POULTRY: ["الوطنية", "شهد", "كوكي", "أطياب", "حلواني", "الوادي"],
  FISH: ["أسماك", "سي فود", "أمريكانا", "صن شاين"], // Branded frozen fish
  VEG_FRUIT: ["مزارع دينا", "وادي فود", "بشائر"],
  BAKERY: ["ريتش بيك", "لوزين", "مونجيني", "سيموندس", "إيتوال"],
  STATIONERY: ["روكو", "فابر كاستل", "بريما", "مينترا", "سيمبا"],
};

export const WEIGHTS = [250, 500, 1000, 2000, 5000];
export const VOLUMES = ["250ml", "500ml", "1L", "1.5L", "2L", "2.25L"];
export const TYPES = ["ممتاز", "بلدي", "شركة", "طازج", "مجمد", "فاخر"];

export class ProductGenerationHelper {
  static generateVariations(
    baseNameAr: string,
    baseNameEn: string,
    brand: string,
    category: string,
  ): ProductVariation[] {
    const variations: ProductVariation[] = [];

    // Liquid products (Milk, Juice, Soda, Oils)
    if (["DAIRY", "DRINKS", "CLEANING"].includes(category)) {
      VOLUMES.forEach((vol) => {
        const arVol = vol.replace("L", " لتر").replace("ml", " مل");
        variations.push({
          nameAr: `${baseNameAr} ${brand} ${arVol}`,
          nameEn: `${brand} ${baseNameEn} ${vol}`,
          volume: vol,
        });
      });
    }
    // Weight based products (Rice, Meat, Veg)
    else if (["MEAT", "POULTRY", "VEG_FRUIT", "GROCERY"].includes(category)) {
      WEIGHTS.forEach((weight) => {
        const unitAr = weight >= 1000 ? "كيلو" : "جرام";
        const displayWeight = weight >= 1000 ? weight / 1000 : weight;
        const unitEn = weight >= 1000 ? "kg" : "g";

        variations.push({
          nameAr: `${baseNameAr} ${brand} ${displayWeight} ${unitAr}`,
          nameEn: `${brand} ${baseNameEn} ${displayWeight}${unitEn}`,
          weight: weight,
          weightUnit: weight >= 1000 ? WeightUnit.KG : WeightUnit.GRAM,
        });
      });
    }
    // Fixed units (Stationery, Personal Care, Snacks)
    else {
      TYPES.forEach((type) => {
        variations.push({
          nameAr: `${baseNameAr} ${brand} - ${type}`,
          nameEn: `${brand} ${baseNameEn} (${type})`,
          type: type,
        });
      });
    }

    return variations;
  }

  static getRandomItem<T>(array: T[]): T {
    if (!array || array.length === 0) return null as T;
    return array[Math.floor(Math.random() * array.length)];
  }
}
