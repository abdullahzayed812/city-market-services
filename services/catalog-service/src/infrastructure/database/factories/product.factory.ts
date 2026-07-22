import { createHash } from "crypto";
import { MeasurementType, WeightUnit } from "@city-market/shared";

function deterministicUUID(input: string): string {
  const hash = createHash("sha256").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

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
//  Realistic EGP price ranges (2024-2025, Egyptian market).
//  Weight products: price is per KG.
//  Unit products:  price is per sellable unit/pack.
// ─────────────────────────────────────────────────────────────────────────────
const PRICE_RANGES: Record<string, [number, number]> = {
  DAIRY:        [12,  180],
  EGGS:         [75,  140],
  DRINKS:       [5,   55],
  TEA_COFFEE:   [15,  180],
  GROCERY:      [18,  220],
  CANNED:       [15,  95],
  SPICES:       [30,  320],
  CLEANING:     [15,  180],
  PAPER:        [10,  95],
  PERSONAL_CARE:[10,  180],
  BEAUTY:       [25,  320],
  BABY:         [35,  420],
  PET:          [40,  260],
  KITCHEN:      [8,   75],
  HOUSEHOLD:    [10,  130],
  MEAT:         [220, 480],
  POULTRY:      [80,  220],
  FISH:         [55,  480],
  BAKERY:       [3,   65],
  PASTRY:       [120, 480],
  SNACKS:       [8,   130],
  ROASTERY:     [55,  750],
  VEG_FRUIT:    [8,   140],
  FROZEN:       [55,  220],
  STATIONERY:   [5,   185],
};

// Per-product price overrides for items whose range would be misleading.
// Key = substring of the product name (matched via `.includes`, longest match wins),
// so a single override applies to every brand/size variant of that item.
const PRICE_OVERRIDES: Record<string, [number, number]> = {
  // Dairy
  "حليب طازج كامل الدسم":       [35,  55],
  "حليب معقم طويل الأمد":        [25,  48],
  "حليب مكثف محلى":              [22,  42],
  "حليب سائل مبخر":              [18,  32],
  "زبادي طبيعي":                 [12,  30],
  "زبادي بالفراولة":             [14,  28],
  "زبادي بالمانجو":              [14,  28],
  "زبادي بالفواكه":               [14,  28],
  "لبن رايب":                    [18,  32],
  "لبن مخفف":                    [10,  20],
  "قشطة طازجة":                  [20,  55],
  "قشطة معلبة":                  [18,  32],
  "كريمة الطهي":                 [28,  60],
  "زبدة بلدية":                  [55,  95],
  "جبنة قريش":                   [28,  60],
  "جبنة بيضاء مملحة":            [55,  95],
  "جبنة رومي":                   [190, 340],
  "جبنة فلمنك":                  [170, 290],
  "جبنة بيضاء مطبوخة":           [60,  110],
  "جبنة موزاريلا":               [90,  220],
  "جبنة موتزاريلا":              [120, 220],
  "جبنة كريم":                   [45,  110],
  "جبنة مثلثات":                 [35,  85],
  "جبنة شيدر":                   [60,  140],
  "جبنة فيتا":                   [90,  170],
  "لبنة":                        [55,  100],
  "سمن نباتي":                   [90,  240],
  // Eggs
  "بيض بلدي":                    [90,  150],
  "بيض أبيض":                    [75,  130],
  "بيض بط":                      [95,  145],
  "بيض سمان":                    [40,  70],
  // Drinks & water
  "مياه معدنية طبيعية":           [5,   45],
  "مياه شرب معبأة":               [5,   40],
  "مياه غازية بالليمون":          [10,  22],
  "مياه تونيك":                   [15,  28],
  "مشروب غازي كولا":             [12,  60],
  "كولا زيرو":                    [12,  60],
  "مشروب غازي بالليمون":         [12,  55],
  "مشروب غازي بالبرتقال":        [12,  55],
  "مشروب الشعير بالفواكه":       [15,  35],
  "مشروب طاقة":                   [28,  65],
  "عصير مانجو":                   [18,  45],
  "عصير برتقال":                  [18,  45],
  "عصير جوافة":                   [18,  40],
  "عصير مشكل فواكه":              [18,  42],
  "مسحوق عصير بالبرتقال":         [10,  35],
  // Tea & coffee
  "شاي أسود أكياس":               [30,  95],
  "شاي أخضر بالنعناع":           [35,  90],
  "شاي أحمر مطحون":              [25,  70],
  "قهوة فورية كلاسيك":            [45,  150],
  "قهوة فورية ٣ في ١":            [15,  55],
  "جولد قهوة فورية":              [90,  200],
  "قهوة تركية مطحونة سادة":       [80,  170],
  "قهوة تركية بالهيل":            [90,  180],
  "كركديه مجفف":                  [30,  65],
  "سحلب بودرة":                   [40,  90],
  // Meat per kg
  "لحم بقري موزة":                [280, 400],
  "لحم بقري مفروم":               [260, 380],
  "لحم بقري فيليه":               [380, 480],
  "كبدة بقري":                   [180, 260],
  "لحم ضاني مشكل":               [310, 450],
  "لحم ضاني فخذ":                [300, 440],
  "ضلوع ضاني":                   [260, 380],
  "كبدة ضاني":                   [170, 250],
  "سجق بلدي":                    [180, 280],
  "كفتة طازجة":                  [220, 320],
  "كوارع بقري":                   [120, 200],
  // Poultry per kg
  "فراخ بيضاء كاملة":            [85,  130],
  "صدور دجاج":                   [130, 200],
  "أوراك دجاج":                   [95,  145],
  "أجنحة دجاج":                   [80,  120],
  "دجاج بلدي كامل":               [165, 240],
  "ديك رومي كامل":                [180, 280],
  "بط كامل":                     [130, 210],
  "سمان":                        [45,  85],
  // Fish per kg
  "سمك بلطي طازج":                [70,  110],
  "سمك بوري طازج":                [120, 200],
  "سمك دنيس":                    [180, 320],
  "سمك قاروص":                   [200, 360],
  "سمك سالمون طازج":             [420, 650],
  "استاكوزا طازجة":              [600, 950],
  "جمبري كبير":                   [260, 420],
  "جمبري وسط":                   [160, 280],
  "فسيخ":                        [180, 350],
  "رنجة مدخنة":                   [120, 220],
  "كابوريا طازجة":                [250, 420],
  "بياض بوري (بطارخ)":           [280, 500],
  // Bakery
  "عيش بلدي":                    [3,   8],
  "عيش فينو":                    [5,   12],
  "توست أبيض":                   [30,  55],
  "توست أسمر":                   [32,  58],
  "كعك بالسمسم":                 [20,  40],
  "فطير مشلتت":                  [25,  55],
  // Pastry per kg
  "بقلاوة":                      [180, 380],
  "كنافة طازجة":                  [140, 280],
  "كنافة بالجبنة":                [160, 320],
  "بسبوسة":                      [90,  180],
  "قطايف":                       [120, 250],
  // Roastery per kg
  "فستق حلبي محمص":              [480, 750],
  "لوز محمص":                    [280, 420],
  "كاجو محمص":                   [280, 420],
  "فول سوداني محمص":              [55,  95],
  "لب سوبر محمص":                [60,  100],
  "لب أبيض (حب البطيخ)":        [70,  120],
  "زبيب أخضر":                   [65,  120],
  "تمر مجدول":                   [120, 280],
  "قهوة عربية مطحونة":            [100, 200],
  "قهوة تركية مطحونة":           [80,  160],
  // Veg/fruit per kg
  "طماطم":                        [10,  35],
  "بطاطس":                        [18,  40],
  "بصل أحمر":                    [15,  35],
  "ثوم بلدي":                    [45,  100],
  "موز":                         [30,  55],
  "برتقال":                       [20,  45],
  "مانجو":                        [40,  90],
  "فراولة":                       [35,  80],
  "بطيخ":                         [12,  28],
  "أفوكادو":                      [120, 220],
  "توت أزرق":                     [180, 320],
  // Grocery — weight items per kg
  "أرز مصري":                    [35,  58],
  "أرز بسمتي":                   [55,  90],
  "سكر أبيض":                    [35,  55],
  "دقيق أبيض فاخر":               [30,  55],
  "عدس أصفر":                    [38,  62],
  "فول مجفف":                    [42,  75],
  // Spices per 100g (system stores price as per-kg, UI shows /100g)
  "كمون مطحون":                   [30,  60],
  "فلفل أسود مطحون":              [45,  90],
  "كركم":                        [40,  80],
  "حبة البركة":                  [55,  120],
  "زعفران":                       [250, 320],
  // Cleaning & household
  "مسحوق غسيل أوتوماتيك":        [70,  260],
  "مسحوق غسيل يدوي وأوتوماتيك":  [60,  240],
  "سائل غسيل ملابس":             [80,  220],
  "سائل غسيل أطباق":             [35,  110],
  "أقراص غسالة أطباق":           [90,  220],
  "كلور مطهر ومبيض":             [20,  55],
  "بطاريات قلوية":                [30,  90],
  "لمبة ليد":                    [35,  90],
  // Baby
  "حفاضات مقاس":                  [90,  320],
  "حليب أطفال مجفف":             [180, 420],
  "غذاء أطفال بالحبوب والفاكهة": [45,  90],
  // Pet
  "طعام قطط جاف":                 [90,  380],
  "طعام قطط رطب":                 [20,  45],
  "طعام كلاب جاف":                [140, 420],
  "طعام كلاب رطب":                [25,  55],
  "رمل قطط معطر":                 [90,  220],
};

function realisticPrice(productName: string, categoryKey: string): number {
  let range: [number, number] | undefined;
  let bestMatchLength = -1;
  for (const key of Object.keys(PRICE_OVERRIDES)) {
    if (productName.includes(key) && key.length > bestMatchLength) {
      range = PRICE_OVERRIDES[key];
      bestMatchLength = key.length;
    }
  }
  const [min, max] = range ?? PRICE_RANGES[categoryKey] ?? [20, 150];
  // Random within range, rounded to nearest 0.5 EGP
  const raw = min + Math.random() * (max - min);
  return Math.round(raw * 2) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Global product catalog — Egyptian supermarket / hypermarket inventory
//  (Carrefour, Spinneys, Metro, Seoudi, Kazyon, BIM, Hyper One, Awlad Ragab...).
//  Rules:
//    • Packaged goods use real Egyptian/regional brands and are named
//      "{Brand} {Product} {Variant} {Size}" — every commonly sold package
//      size is its own SKU (measure = UNIT).
//    • Loose/counter goods (fresh meat, produce, deli cheese, nuts, spices)
//      stay unbranded and priced per kg (measure = WEIGHT), matching how
//      they are actually sold in Egyptian markets.
//    • All names are Arabic. No fake products or fabricated brands.
// ─────────────────────────────────────────────────────────────────────────────
interface ProductDef {
  name: string;
  description: string;
  measure: MeasurementType;
}

interface ProductLine {
  brand: string;
  product: string;
  sizes: string[];
  measure: MeasurementType;
  desc: string;
}

// Expands brand/product/size combinations into individual SKUs, e.g.
// { brand: "جهينة", product: "حليب طازج كامل الدسم", sizes: ["٥٠٠ مل", "١ لتر"] }
// → "جهينة حليب طازج كامل الدسم ٥٠٠ مل", "جهينة حليب طازج كامل الدسم ١ لتر"
function expand(lines: ProductLine[]): ProductDef[] {
  const seen = new Set<string>();
  const out: ProductDef[] = [];
  for (const line of lines) {
    for (const size of line.sizes) {
      const name = `${line.brand} ${line.product} ${size}`.replace(/\s+/g, " ").trim();
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({ name, description: line.desc, measure: line.measure });
    }
  }
  return out;
}

// Expands an unbranded base product across its commonly available package sizes.
function sized(base: string, desc: string, sizes: string[], measure: MeasurementType): ProductDef[] {
  return sizes.map((size) => ({ name: `${base} ${size}`.replace(/\s+/g, " ").trim(), description: desc, measure }));
}

const GLOBAL_PRODUCTS: Record<string, ProductDef[]> = {

  // ── Dairy: milk, yogurt, cheese, butter, ghee, cream ───────────────────────
  DAIRY: [
    ...expand([
      { brand: "جهينة",  product: "حليب طازج كامل الدسم",  sizes: ["٢٠٠ مل", "٥٠٠ مل", "١ لتر"], measure: MeasurementType.UNIT, desc: "حليب بقري طازج كامل الدسم من جهينة" },
      { brand: "جهينة",  product: "حليب طازج نصف دسم",     sizes: ["٥٠٠ مل", "١ لتر"],           measure: MeasurementType.UNIT, desc: "حليب بقري منخفض الدسم من جهينة" },
      { brand: "جهينة",  product: "حليب معقم طويل الأمد",   sizes: ["١ لتر"],                     measure: MeasurementType.UNIT, desc: "حليب معقم طويل الأمد من جهينة يصلح للتخزين" },
      { brand: "جهينة",  product: "زبادي طبيعي",            sizes: ["١٢٠ جم", "٢٠٠ جم", "٩٠٠ جم"], measure: MeasurementType.UNIT, desc: "زبادي طبيعي كامل الدسم من جهينة" },
      { brand: "جهينة",  product: "زبادي بالفراولة",        sizes: ["١٢٠ جم", "٢٠٠ جم"],           measure: MeasurementType.UNIT, desc: "زبادي كريمي بنكهة الفراولة من جهينة" },
      { brand: "جهينة",  product: "زبادي بالمانجو",         sizes: ["١٢٠ جم", "٢٠٠ جم"],           measure: MeasurementType.UNIT, desc: "زبادي كريمي بنكهة المانجو من جهينة" },
      { brand: "جهينة",  product: "قشطة طازجة",             sizes: ["١٧٠ جم", "٤٥٠ جم"],           measure: MeasurementType.UNIT, desc: "قشطة طازجة كاملة الدسم من جهينة" },
      { brand: "جهينة",  product: "جبنة قريش",              sizes: ["٢٥٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة قريش طازجة بيضاء معبأة من جهينة" },
      { brand: "جهينة",  product: "زبدة",                   sizes: ["٢٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "زبدة طبيعية من جهينة" },
      { brand: "جهينة",  product: "كريمة الطهي",            sizes: ["١٧٠ جم"],                     measure: MeasurementType.UNIT, desc: "كريمة سائلة خفيفة للطهي والصلصات من جهينة" },
      { brand: "بيتي",   product: "حليب طازج كامل الدسم",  sizes: ["٥٠٠ مل", "١ لتر"],           measure: MeasurementType.UNIT, desc: "حليب بقري طازج كامل الدسم من بيتي" },
      { brand: "بيتي",   product: "حليب طازج نصف دسم",     sizes: ["١ لتر"],                     measure: MeasurementType.UNIT, desc: "حليب بقري منخفض الدسم من بيتي" },
      { brand: "بيتي",   product: "زبادي طبيعي",            sizes: ["١٢٠ جم", "٢٠٠ جم", "٨٥٠ جم"], measure: MeasurementType.UNIT, desc: "زبادي طبيعي طازج من بيتي" },
      { brand: "بيتي",   product: "زبادي بالفواكه",         sizes: ["١٢٠ جم"],                     measure: MeasurementType.UNIT, desc: "زبادي كريمي بنكهات الفواكه من بيتي" },
      { brand: "بيتي",   product: "قشطة طازجة",             sizes: ["٢٥٠ جم"],                     measure: MeasurementType.UNIT, desc: "قشطة طازجة كاملة الدسم من بيتي" },
      { brand: "بيتي",   product: "جبنة قريش",              sizes: ["٢٥٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة قريش طازجة معبأة من بيتي" },
      { brand: "المراعي", product: "حليب طويل الأجل كامل الدسم", sizes: ["١ لتر"],               measure: MeasurementType.UNIT, desc: "حليب معقم طويل الأجل كامل الدسم من المراعي" },
      { brand: "المراعي", product: "حليب طويل الأجل خالي الدسم", sizes: ["١ لتر"],               measure: MeasurementType.UNIT, desc: "حليب معقم طويل الأجل خالي الدسم من المراعي" },
      { brand: "المراعي", product: "زبادي طبيعي",           sizes: ["١٧٠ جم"],                     measure: MeasurementType.UNIT, desc: "زبادي طبيعي من المراعي" },
      { brand: "دينا فارمز", product: "حليب طازج كامل الدسم", sizes: ["٥٠٠ مل", "١ لتر"],         measure: MeasurementType.UNIT, desc: "حليب بقري طازج كامل الدسم من دينا فارمز" },
      { brand: "دينا فارمز", product: "زبادي طبيعي",         sizes: ["١٧٠ جم"],                     measure: MeasurementType.UNIT, desc: "زبادي طبيعي طازج من دينا فارمز" },
      { brand: "لاكتيل", product: "حليب معقم طويل الأمد",   sizes: ["١ لتر"],                     measure: MeasurementType.UNIT, desc: "حليب معقم طويل الأمد من لاكتيل" },
      { brand: "نستله نيدو", product: "حليب بودرة كامل الدسم", sizes: ["٤٠٠ جم", "٩٠٠ جم"],       measure: MeasurementType.UNIT, desc: "حليب بودرة كامل الدسم من نستله نيدو" },
      { brand: "نستله",  product: "حليب مكثف محلى (كارنيشن)", sizes: ["١٧٠ جم", "٣٩٧ جم"],        measure: MeasurementType.UNIT, desc: "حليب مكثف محلى بالسكر من نستله كارنيشن" },
      { brand: "نستله",  product: "حليب سائل مبخر",         sizes: ["١٧٠ جم"],                     measure: MeasurementType.UNIT, desc: "حليب سائل مبخر من نستله" },
      { brand: "نستله",  product: "كريمة الطهي",            sizes: ["١٧٠ جم", "٢٥٠ مل"],           measure: MeasurementType.UNIT, desc: "كريمة سائلة خفيفة للطهي من نستله" },
      { brand: "دومتي",  product: "جبنة قريش",              sizes: ["٢٥٠ جم", "٥٠٠ جم"],           measure: MeasurementType.UNIT, desc: "جبنة قريش طازجة قليلة الدسم من دومتي" },
      { brand: "دومتي",  product: "جبنة فيتا",              sizes: ["٥٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة فيتا بيضاء في المحلول من دومتي" },
      { brand: "دومتي",  product: "جبنة شيدر شرائح",        sizes: ["١٥٠ جم"],                     measure: MeasurementType.UNIT, desc: "شرائح جبنة شيدر جاهزة من دومتي" },
      { brand: "دومتي",  product: "جبنة موزاريلا",          sizes: ["٤٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة موزاريلا للبيتزا من دومتي" },
      { brand: "دومتي",  product: "جبنة مثلثات",            sizes: ["١٤٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة مثلثات مصهورة سهلة الدهن من دومتي" },
      { brand: "دومتي",  product: "لبنة",                   sizes: ["٢٥٠ جم"],                     measure: MeasurementType.UNIT, desc: "لبنة كريمية طازجة من دومتي" },
      { brand: "دومتي",  product: "جبنة رومي",              sizes: ["٢٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة رومي صلبة معبأة من دومتي" },
      { brand: "العبور لاند", product: "جبنة شيدر",         sizes: ["٢٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة شيدر معبأة من العبور لاند" },
      { brand: "العبور لاند", product: "جبنة موزاريلا",     sizes: ["٤٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة موزاريلا معبأة من العبور لاند" },
      { brand: "العبور لاند", product: "جبنة رومي",         sizes: ["٢٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة رومي معبأة من العبور لاند" },
      { brand: "باندا",  product: "جبنة مثلثات",            sizes: ["١٤٠ جم", "٢٤٠ جم"],           measure: MeasurementType.UNIT, desc: "جبنة مثلثات كريمية من باندا" },
      { brand: "باندا",  product: "جبنة شرائح",             sizes: ["١٥٠ جم"],                     measure: MeasurementType.UNIT, desc: "شرائح جبنة جاهزة من باندا" },
      { brand: "كيري",   product: "جبنة مثلثات",            sizes: ["١٢٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة مثلثات كريمية فرنسية من كيري" },
      { brand: "غندور",  product: "جبنة مثلثات",            sizes: ["١٤٠ جم"],                     measure: MeasurementType.UNIT, desc: "جبنة مثلثات كريمية من غندور" },
      { brand: "عافية",  product: "سمن نباتي",              sizes: ["٦٥٠ جم", "١.٥ كجم"],           measure: MeasurementType.UNIT, desc: "سمن نباتي صلب للخبز والطهي من عافية" },
      { brand: "كريستال", product: "سمن نباتي",             sizes: ["٦٥٠ جم", "١.٥ كجم"],           measure: MeasurementType.UNIT, desc: "سمن نباتي صلب للخبز والطهي من كريستال" },
    ]),
    // Loose / deli-counter dairy (unbranded, sold by weight or informally)
    { name: "لبن رايب",                description: "لبن رايب بلدي طازج كريمي",                 measure: MeasurementType.UNIT },
    { name: "لبن مخفف",                description: "لبن بقري مخفف خفيف ومنعش",                measure: MeasurementType.UNIT },
    { name: "قشطة معلبة",              description: "قشطة محلاة معلبة للحلويات",                measure: MeasurementType.UNIT },
    { name: "زبدة بلدية",              description: "زبدة بقري بلدية مملحة طازجة",              measure: MeasurementType.WEIGHT },
    { name: "سمن بلدي",                description: "سمن حيواني بلدي أصيل النكهة",              measure: MeasurementType.WEIGHT },
    { name: "جبنة قريش",               description: "جبنة قريش طازجة بيضاء من عداد الألبان",   measure: MeasurementType.WEIGHT },
    { name: "جبنة بيضاء مملحة",        description: "جبنة بيضاء مملحة في المحلول من عداد الألبان", measure: MeasurementType.WEIGHT },
    { name: "جبنة رومي",               description: "جبنة رومي صلبة ذات طعم حاد من عداد الألبان", measure: MeasurementType.WEIGHT },
    { name: "جبنة فلمنك",              description: "جبنة فلمنك شبه صلبة خفيفة الطعم",         measure: MeasurementType.WEIGHT },
    { name: "جبنة موزاريلا",           description: "جبنة موزاريلا طازجة للبيتزا والسلطات",    measure: MeasurementType.WEIGHT },
  ],

  // ── Eggs ───────────────────────────────────────────────────────────────────
  EGGS: [
    ...sized("بيض أبيض", "بيض دجاج أبيض طازج حجم كبير", ["دستة (١٢ بيضة)", "٢٠ بيضة", "٣٠ بيضة"], MeasurementType.UNIT),
    ...sized("بيض بلدي", "بيض دجاج بلدي طازج من مزارع محلية", ["دستة (١٢ بيضة)", "١٥ بيضة", "٣٠ بيضة"], MeasurementType.UNIT),
    ...sized("بيض بط", "بيض بط طازج ذو صفار كبير ودسم", ["دستة (١٢ بيضة)"], MeasurementType.UNIT),
    ...sized("بيض سمان", "بيض سمان طازج صغير الحجم غني بالبروتين", ["٣٠ بيضة"], MeasurementType.UNIT),
  ],

  // ── Dry grocery: rice, pasta, flour, sugar, salt, oil, legumes ────────────
  GROCERY: [
    ...expand([
      { brand: "أبو كاس", product: "أرز أبيض مصري",              sizes: ["١ كجم", "٢ كجم", "٥ كجم"],                   measure: MeasurementType.UNIT, desc: "أرز أبيض مصري معبأ من أبو كاس" },
      { brand: "أبو كاس", product: "أرز بسمتي",                  sizes: ["٢ كجم", "٥ كجم"],                             measure: MeasurementType.UNIT, desc: "أرز بسمتي معبأ فاخر من أبو كاس" },
      { brand: "ريجينا",  product: "مكرونة سباغيتي",             sizes: ["٢٥٠ جم", "٤٠٠ جم"],                           measure: MeasurementType.UNIT, desc: "مكرونة سباغيتي قمح صلب من ريجينا" },
      { brand: "ريجينا",  product: "مكرونة قلم",                 sizes: ["٤٠٠ جم"],                                     measure: MeasurementType.UNIT, desc: "مكرونة قلم من ريجينا للبشاميل" },
      { brand: "ريجينا",  product: "مكرونة فرخة",                sizes: ["٤٠٠ جم"],                                     measure: MeasurementType.UNIT, desc: "مكرونة فرخة عريضة من ريجينا" },
      { brand: "أطلس",    product: "مكرونة سباغيتي",             sizes: ["٤٠٠ جم"],                                     measure: MeasurementType.UNIT, desc: "مكرونة سباغيتي قمح صلب من أطلس" },
      { brand: "أطلس",    product: "مكرونة ريشة",                sizes: ["٤٠٠ جم"],                                     measure: MeasurementType.UNIT, desc: "مكرونة ريشة صلبة للصلصات من أطلس" },
      { brand: "كريستال", product: "زيت ذرة",                    sizes: ["٧٠٠ مل", "١ لتر", "١.٦ لتر", "٢.٢ لتر", "٣ لتر"], measure: MeasurementType.UNIT, desc: "زيت ذرة نقي للقلي والطهي من كريستال" },
      { brand: "كريستال", product: "زيت عباد الشمس",             sizes: ["١ لتر", "١.٦ لتر", "٢.٢ لتر"],                measure: MeasurementType.UNIT, desc: "زيت عباد شمس خفيف من كريستال" },
      { brand: "كريستال", product: "زيت زيتون بكر ممتاز",       sizes: ["٥٠٠ مل", "١ لتر"],                            measure: MeasurementType.UNIT, desc: "زيت زيتون بكر ممتاز ضغط بارد من كريستال" },
      { brand: "عافية",   product: "زيت دوار الشمس",             sizes: ["٧٠٠ مل", "١.٦ لتر", "٢.٢ لتر", "٣ لتر"],      measure: MeasurementType.UNIT, desc: "زيت دوار الشمس من عافية" },
      { brand: "عافية",   product: "زيت ذرة",                    sizes: ["١.٦ لتر", "٢.٢ لتر"],                        measure: MeasurementType.UNIT, desc: "زيت ذرة نقي من عافية" },
      { brand: "وادي فود", product: "زيت عباد الشمس",            sizes: ["١ لتر", "١.٦ لتر", "٢.٢ لتر"],                measure: MeasurementType.UNIT, desc: "زيت عباد الشمس من وادي فود" },
      { brand: "وادي فود", product: "زيت خلطة نباتي للقلي",      sizes: ["١.٦ لتر", "٢.٢ لتر"],                        measure: MeasurementType.UNIT, desc: "زيت خلطة نباتي للقلي من وادي فود" },
    ]),
    ...sized("سكر أبيض",           "سكر أبيض ناعم مكرر للاستخدام اليومي",        ["١ كجم", "٢ كجم", "٥ كجم"], MeasurementType.UNIT),
    ...sized("دقيق أبيض فاخر",     "دقيق قمح أبيض متعدد الاستخدامات",             ["١ كجم", "٢ كجم", "٥ كجم"], MeasurementType.UNIT),
    ...sized("ملح طعام ميود",      "ملح طعام أبيض ناعم مضاف إليه يود",             ["٢٥٠ جم", "٥٠٠ جم", "١ كجم"], MeasurementType.UNIT),
    ...sized("خل أبيض",            "خل أبيض طبيعي للطبخ والتخليل",                 ["٥٠٠ مل", "١ لتر"], MeasurementType.UNIT),
    ...sized("طحينية سمسم",        "طحينية سمسم نقية ناعمة القوام",                ["٤٠٠ جم", "٨٠٠ جم"], MeasurementType.UNIT),
    ...sized("عسل نحل طبيعي",      "عسل نحل طبيعي 100% بدون إضافات",              ["٢٥٠ جم", "٥٠٠ جم", "١ كجم"], MeasurementType.UNIT),
    ...sized("مربى فراولة",        "مربى فراولة حلو طبيعي للفطار",                 ["٣٤٠ جم"], MeasurementType.UNIT),
    ...sized("مربى برتقال",        "مربى برتقال بقشر الترنج العطري",              ["٣٤٠ جم"], MeasurementType.UNIT),
    ...sized("نشا ذرة",            "نشا ذرة أبيض ناعم للصلصات والحلويات",         ["٢٠٠ جم"], MeasurementType.UNIT),
    ...sized("بيكنج باودر",        "مسحوق الخبيز لتخمير العجائن والكيك",           ["١٠٠ جم"], MeasurementType.UNIT),
    ...sized("خميرة فورية",        "خميرة جافة فورية لتخمير العجين والخبز",       ["١١ جم", "٥٠٠ جم"], MeasurementType.UNIT),
    ...sized("كاكاو خام",          "مسحوق كاكاو داكن للحلويات والمخبوزات",        ["٢٥٠ جم"], MeasurementType.UNIT),
    ...sized("بقسماط مطحون",       "فتت بقسماط مطحون للتحميص والبانيه",           ["٢٥٠ جم"], MeasurementType.UNIT),
    ...sized("شعرية",              "شعرية قمح رفيعة للشوربة والأرز",              ["٢٥٠ جم", "٤٠٠ جم"], MeasurementType.UNIT),
    // Loose bulk dry goods (sold by weight)
    { name: "أرز مصري",   description: "أرز مصري أبيض قصير الحبة",             measure: MeasurementType.WEIGHT },
    { name: "أرز بسمتي",  description: "أرز بسمتي طويل الحبة ذو رائحة عطرة",  measure: MeasurementType.WEIGHT },
    { name: "سميد خشن",   description: "سميد قمح خشن للحلويات والكيك",         measure: MeasurementType.WEIGHT },
    { name: "فريك",       description: "قمح أخضر مدخن ذو نكهة مميزة",          measure: MeasurementType.WEIGHT },
    { name: "برغل خشن",   description: "برغل قمح خشن للتبولة والطبخ",          measure: MeasurementType.WEIGHT },
    { name: "عدس أصفر",   description: "عدس أصفر مقشور سريع الطهي",           measure: MeasurementType.WEIGHT },
    { name: "عدس أحمر",   description: "عدس أحمر مجروش للشوربة والأطباق",      measure: MeasurementType.WEIGHT },
    { name: "فول مجفف",   description: "فول بلدي مجفف للفول المدمس والأطباق",  measure: MeasurementType.WEIGHT },
    { name: "حمص مجفف",   description: "حمص مجفف للطهي والحمص الشامي",         measure: MeasurementType.WEIGHT },
    { name: "لوبيا",      description: "لوبيا جافة بيضاء أو حمراء للطهي",      measure: MeasurementType.WEIGHT },
  ],

  // ── Canned & jarred food, sauces, condiments ───────────────────────────────
  CANNED: [
    ...expand([
      { brand: "هاينز",    product: "كاتشب طماطم",                 sizes: ["٣٤٠ جم", "٥٧٠ جم", "٩١٠ جم"], measure: MeasurementType.UNIT, desc: "كاتشب طماطم حلو وحامض جاهز من هاينز" },
      { brand: "هاينز",    product: "مايونيز",                      sizes: ["٢٥٠ مل", "٤٤٥ مل"],           measure: MeasurementType.UNIT, desc: "مايونيز كريمي دسم من هاينز" },
      { brand: "هاينز",    product: "مستردة",                       sizes: ["٢٢٠ جم"],                     measure: MeasurementType.UNIT, desc: "مستردة حريفة للسندوتشات من هاينز" },
      { brand: "هاينز",    product: "صلصة طماطم مطبوخة",           sizes: ["٣٩٠ جم"],                     measure: MeasurementType.UNIT, desc: "صلصة طماطم مطبوخة جاهزة من هاينز" },
      { brand: "أمريكانا", product: "مايونيز",                      sizes: ["٤٤٠ مل"],                     measure: MeasurementType.UNIT, desc: "مايونيز كريمي من أمريكانا" },
      { brand: "أمريكانا", product: "معجون طماطم",                  sizes: ["١٣٥ جم", "٤٠٠ جم"],           measure: MeasurementType.UNIT, desc: "معجون طماطم مركز من أمريكانا" },
      { brand: "أمريكانا", product: "فول مدمس معلب",                sizes: ["٤٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "فول مدمس مطبوخ معلب جاهز من أمريكانا" },
      { brand: "أمريكانا", product: "تونة مفتتة في الزيت",         sizes: ["١٤٢ جم", "١٨٥ جم"],           measure: MeasurementType.UNIT, desc: "تونة مطبوخة معلبة في زيت عباد الشمس من أمريكانا" },
      { brand: "أمريكانا", product: "بازلاء معلبة",                 sizes: ["٤٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "بازلاء خضراء معلبة ناعمة من أمريكانا" },
      { brand: "أمريكانا", product: "ذرة معلبة",                    sizes: ["٤٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "حبوب ذرة صفراء حلوة معلبة من أمريكانا" },
      { brand: "ريو مار",  product: "تونة مفتتة في الزيت",         sizes: ["١٤٢ جم"],                     measure: MeasurementType.UNIT, desc: "تونة مفتتة معلبة في الزيت من ريو مار" },
      { brand: "ريو مار",  product: "تونة قطع في الماء",            sizes: ["١٤٢ جم"],                     measure: MeasurementType.UNIT, desc: "تونة قطع معلبة في الماء من ريو مار" },
      { brand: "كنور",     product: "مكعبات مرقة دجاج",             sizes: ["٢٤ مكعب"],                    measure: MeasurementType.UNIT, desc: "مكعبات مرقة دجاج سريعة التحضير من كنور" },
      { brand: "كنور",     product: "مكعبات مرقة لحم",              sizes: ["٢٤ مكعب"],                    measure: MeasurementType.UNIT, desc: "مكعبات مرقة لحم سريعة التحضير من كنور" },
      { brand: "كنور",     product: "شوربة دجاج جاهزة",             sizes: ["٦٥ جم"],                      measure: MeasurementType.UNIT, desc: "شوربة دجاج سريعة التحضير من كنور" },
      { brand: "ماجي",     product: "مكعبات مرقة دجاج",             sizes: ["٢٤ مكعب"],                    measure: MeasurementType.UNIT, desc: "مكعبات مرقة دجاج من ماجي" },
      { brand: "ماجي",     product: "صلصة طماطم جاهزة للطبخ",      sizes: ["٥٠٠ جم"],                     measure: MeasurementType.UNIT, desc: "صلصة طماطم مطبوخة جاهزة للاستخدام من ماجي" },
    ]),
    { name: "صلصة حارة",  description: "صلصة فلفل حار للطبخ والتقديم",            measure: MeasurementType.UNIT },
    { name: "صلصة صويا",  description: "صلصة صويا مالحة للتتبيل والطبخ الآسيوي", measure: MeasurementType.UNIT },
  ],

  // ── Spices & dried herbs (mostly loose/counter-weighed) ───────────────────
  SPICES: [
    { name: "كمون مطحون",              description: "كمون أصفر مطحون ناعم لأطباق الفول والعدس", measure: MeasurementType.WEIGHT },
    { name: "كزبرة مطحونة",            description: "كزبرة جافة مطحونة للتتبيل والشوربات",     measure: MeasurementType.WEIGHT },
    { name: "فلفل أسود مطحون",         description: "فلفل أسود مطحون حار للأطباق الرئيسية",    measure: MeasurementType.WEIGHT },
    { name: "بهارات مشكلة",            description: "خلطة بهارات عربية كاملة السبع بهارات",     measure: MeasurementType.WEIGHT },
    { name: "كركم",                    description: "كركم مطحون ذهبي للأرز والأطباق المصرية",   measure: MeasurementType.WEIGHT },
    { name: "شطة حمراء مطحونة",        description: "فلفل أحمر حار مطحون للأطباق الحارة",       measure: MeasurementType.WEIGHT },
    { name: "قرفة مطحونة",             description: "قرفة مطحونة عطرية للحلويات والبهارات",     measure: MeasurementType.WEIGHT },
    { name: "هيل مطحون",               description: "هيل أخضر مطحون للقهوة والحلويات",          measure: MeasurementType.WEIGHT },
    { name: "زنجبيل مجفف",             description: "زنجبيل جاف مطحون للشاي والطبخ",            measure: MeasurementType.WEIGHT },
    { name: "يانسون",                  description: "بذور يانسون كاملة للشاي والمخبوزات",       measure: MeasurementType.WEIGHT },
    { name: "كراوية",                  description: "بذور كراوية حبة للخبز والبهارات",           measure: MeasurementType.WEIGHT },
    { name: "ورق غار مجفف",            description: "ورق غار مجفف للشوربات والمرق",             measure: MeasurementType.WEIGHT },
    { name: "زعتر مجفف",               description: "زعتر أخضر مجفف للمناقيش والسلطات",        measure: MeasurementType.WEIGHT },
    { name: "حبة البركة",              description: "حبة البركة السوداء للطب النبوي والطهي",    measure: MeasurementType.WEIGHT },
    { name: "فلفل أبيض مطحون",         description: "فلفل أبيض مطحون خفيف للصلصات البيضاء",   measure: MeasurementType.WEIGHT },
    { name: "بابريكا",                 description: "فلفل أحمر حلو مطحون لتلوين الأطباق",       measure: MeasurementType.WEIGHT },
    { name: "بهارات شاورما",            description: "خلطة بهارات شاورما جاهزة مميزة",            measure: MeasurementType.WEIGHT },
    { name: "بهارات كباب",              description: "خلطة توابل الكباب والكفتة التقليدية",       measure: MeasurementType.WEIGHT },
    { name: "بهارات دجاج",              description: "خلطة توابل مخصصة للدجاج المشوي",           measure: MeasurementType.WEIGHT },
    { name: "بهارات سمك",               description: "خلطة توابل مخصصة للأسماك المشوية",         measure: MeasurementType.WEIGHT },
    { name: "سماق",                    description: "سماق أحمر حامض للتتبيل والسلطات",          measure: MeasurementType.WEIGHT },
    { name: "مسحوق كاري",              description: "خلطة كاري هندية معتدلة الحرارة",            measure: MeasurementType.WEIGHT },
    { name: "زعفران",                  description: "زعفران حقيقي ذو رائحة ولون مميزَين",        measure: MeasurementType.WEIGHT },
  ],

  // ── Soft drinks, juices, mineral water ─────────────────────────────────────
  DRINKS: [
    ...expand([
      { brand: "بيبسي",      product: "مشروب غازي كولا",         sizes: ["كان ٣٣٠ مل", "٢٥٠ مل", "٥٠٠ مل", "١ لتر", "١.٥ لتر", "٢.٢٥ لتر"], measure: MeasurementType.UNIT, desc: "مشروب غازي بنكهة الكولا من بيبسي" },
      { brand: "كوكاكولا",   product: "مشروب غازي كولا",         sizes: ["كان ٣٣٠ مل", "٢٥٠ مل", "٥٠٠ مل", "١ لتر", "١.٥ لتر", "٢.٢٥ لتر"], measure: MeasurementType.UNIT, desc: "مشروب غازي بنكهة الكولا الأصلية من كوكاكولا" },
      { brand: "كوكاكولا",   product: "كولا زيرو",                sizes: ["كان ٣٣٠ مل", "١ لتر"],                                         measure: MeasurementType.UNIT, desc: "مشروب غازي كولا بدون سكر من كوكاكولا" },
      { brand: "سبرايت",     product: "مشروب غازي بالليمون",     sizes: ["كان ٣٣٠ مل", "٥٠٠ مل", "١ لتر", "٢.٢٥ لتر"],                   measure: MeasurementType.UNIT, desc: "مشروب غازي بنكهة الليمون من سبرايت" },
      { brand: "فانتا",      product: "مشروب غازي بالبرتقال",    sizes: ["كان ٣٣٠ مل", "٥٠٠ مل", "١ لتر", "٢.٢٥ لتر"],                   measure: MeasurementType.UNIT, desc: "مشروب غازي بنكهة البرتقال من فانتا" },
      { brand: "سفن أب",     product: "مشروب غازي بالليمون",     sizes: ["كان ٣٣٠ مل", "٥٠٠ مل", "١ لتر", "٢.٢٥ لتر"],                   measure: MeasurementType.UNIT, desc: "مشروب غازي بنكهة الليمون من سفن أب" },
      { brand: "ميريندا",    product: "مشروب غازي بالبرتقال",    sizes: ["كان ٣٣٠ مل", "٥٠٠ مل", "١ لتر", "٢.٢٥ لتر"],                   measure: MeasurementType.UNIT, desc: "مشروب غازي بنكهة البرتقال من ميريندا" },
      { brand: "شويبس",      product: "مياه غازية بالليمون",     sizes: ["٢٥٠ مل", "١ لتر"],                                             measure: MeasurementType.UNIT, desc: "مشروب غازي منعش بنكهة الليمون من شويبس" },
      { brand: "شويبس",      product: "مياه تونيك",               sizes: ["٢٥٠ مل"],                                                       measure: MeasurementType.UNIT, desc: "مياه تونيك فوارة من شويبس" },
      { brand: "فيروز",      product: "مشروب الشعير بالفواكه",   sizes: ["٣٣٠ مل", "١ لتر"],                                             measure: MeasurementType.UNIT, desc: "مشروب شعير غازي بنكهة الفاكهة من فيروز" },
      { brand: "باراكة",     product: "مياه معدنية طبيعية",       sizes: ["٦٠٠ مل", "١.٥ لتر", "٥ لتر"],                                  measure: MeasurementType.UNIT, desc: "مياه معدنية طبيعية من باراكة" },
      { brand: "نستله بيور لايف", product: "مياه شرب معبأة",     sizes: ["٦٠٠ مل", "١.٥ لتر"],                                           measure: MeasurementType.UNIT, desc: "مياه شرب نقية من نستله بيور لايف" },
      { brand: "حياة",       product: "مياه معدنية طبيعية",       sizes: ["٦٠٠ مل", "١.٥ لتر", "٥ لتر"],                                  measure: MeasurementType.UNIT, desc: "مياه معدنية طبيعية من حياة" },
      { brand: "أكوافينا",   product: "مياه شرب معبأة",           sizes: ["٦٠٠ مل", "١.٥ لتر"],                                           measure: MeasurementType.UNIT, desc: "مياه شرب منقاة من أكوافينا" },
      { brand: "جهينة",      product: "عصير مانجو طبيعي",         sizes: ["٢٣٥ مل", "١ لتر"],                                             measure: MeasurementType.UNIT, desc: "عصير مانجو طبيعي مركز من جهينة" },
      { brand: "جهينة",      product: "عصير برتقال طبيعي",        sizes: ["٢٣٥ مل", "١ لتر"],                                             measure: MeasurementType.UNIT, desc: "عصير برتقال مضغوط طبيعي من جهينة" },
      { brand: "جهينة",      product: "عصير جوافة طبيعي",         sizes: ["٢٣٥ مل", "١ لتر"],                                             measure: MeasurementType.UNIT, desc: "عصير جوافة طبيعي من جهينة" },
      { brand: "راني",       product: "عصير مانجو",               sizes: ["٢٤٠ مل", "١ لتر"],                                             measure: MeasurementType.UNIT, desc: "عصير مانجو كثيف القوام من راني" },
      { brand: "راني",       product: "عصير برتقال",              sizes: ["٢٤٠ مل", "١ لتر"],                                             measure: MeasurementType.UNIT, desc: "عصير برتقال من راني" },
      { brand: "المراعي",    product: "عصير مشكل فواكه",          sizes: ["٢٥٠ مل", "١ لتر"],                                             measure: MeasurementType.UNIT, desc: "عصير فواكه مشكل من المراعي" },
      { brand: "بيتي",       product: "عصير برتقال",              sizes: ["٢٣٥ مل"],                                                       measure: MeasurementType.UNIT, desc: "عصير برتقال طبيعي من بيتي" },
      { brand: "تانج",       product: "مسحوق عصير بالبرتقال",     sizes: ["٢٥ جم", "٥٠٠ جم"],                                             measure: MeasurementType.UNIT, desc: "مسحوق برتقال سريع التحضير للعصير من تانج" },
      { brand: "باور هورس",  product: "مشروب طاقة",               sizes: ["٢٥٠ مل"],                                                       measure: MeasurementType.UNIT, desc: "مشروب طاقة منعش يزيد التركيز والنشاط" },
      { brand: "ريد بُل",    product: "مشروب طاقة",               sizes: ["٢٥٠ مل"],                                                       measure: MeasurementType.UNIT, desc: "مشروب طاقة عالمي معروف" },
    ]),
  ],

  // ── Tea, coffee & herbal drinks ────────────────────────────────────────────
  TEA_COFFEE: [
    ...expand([
      { brand: "ليبتون",  product: "شاي أسود أكياس",              sizes: ["٢٥ كيس", "١٠٠ كيس"],  measure: MeasurementType.UNIT, desc: "شاي أسود فاخر في أكياس مفردة من ليبتون" },
      { brand: "ليبتون",  product: "شاي أخضر بالنعناع أكياس",     sizes: ["٢٥ كيس"],              measure: MeasurementType.UNIT, desc: "شاي أخضر بنكهة النعناع من ليبتون" },
      { brand: "العروسة", product: "شاي أحمر مطحون",              sizes: ["٢٥٠ جم", "٥٠٠ جم"],   measure: MeasurementType.UNIT, desc: "شاي أحمر مطحون فاخر من العروسة" },
      { brand: "العروسة", product: "شاي أكياس",                   sizes: ["٢٥ كيس"],              measure: MeasurementType.UNIT, desc: "شاي أسود في أكياس مفردة من العروسة" },
      { brand: "أحمد تي", product: "شاي أسود أكياس",              sizes: ["٢٥ كيس"],              measure: MeasurementType.UNIT, desc: "شاي أسود إنجليزي فاخر من أحمد تي" },
      { brand: "نسكافيه", product: "قهوة فورية كلاسيك",           sizes: ["٥٠ جم", "٢٠٠ جم"],    measure: MeasurementType.UNIT, desc: "قهوة فورية كلاسيكية سريعة التحضير من نسكافيه" },
      { brand: "نسكافيه", product: "قهوة فورية ٣ في ١",           sizes: ["كيس مفرد", "علبة ١٠ أكياس"], measure: MeasurementType.UNIT, desc: "قهوة فورية بالحليب والسكر في كيس واحد من نسكافيه" },
      { brand: "نسكافيه", product: "جولد قهوة فورية",             sizes: ["١٠٠ جم"],              measure: MeasurementType.UNIT, desc: "قهوة فورية مركزة فاخرة من نسكافيه جولد" },
      { brand: "أبو عوف", product: "قهوة تركية مطحونة سادة",      sizes: ["٢٥٠ جم"],              measure: MeasurementType.UNIT, desc: "قهوة تركية ناعمة محمصة داكنة من أبو عوف" },
      { brand: "أبو عوف", product: "قهوة تركية بالهيل",           sizes: ["٢٥٠ جم"],              measure: MeasurementType.UNIT, desc: "قهوة تركية بالهيل العطري من أبو عوف" },
    ]),
    ...sized("كركديه مجفف",   "كركديه مجفف للشرب البارد والساخن",     ["١٠٠ جم", "٢٥٠ جم"], MeasurementType.UNIT),
    ...sized("ينسون مجفف",    "بذور يانسون مجففة للشاي المهدئ",       ["١٠٠ جم"], MeasurementType.UNIT),
    ...sized("بابونج مجفف",   "زهور بابونج مجففة للشاي المهدئ",       ["١٠٠ جم"], MeasurementType.UNIT),
    ...sized("قرفة أعواد",    "أعواد قرفة طبيعية للمشروبات الساخنة", ["١٠٠ جم"], MeasurementType.UNIT),
    ...sized("شاي كرك جاهز",  "شاي كرك بالحليب والبهارات جاهز للشرب", ["٢٥٠ مل"], MeasurementType.UNIT),
    ...sized("سحلب بودرة",    "مشروب سحلب دافئ بالجوز والقرفة",       ["٢٥٠ جم"], MeasurementType.UNIT),
  ],

  // ── Packaged snacks: chips, biscuits, wafers, chocolate, candy ────────────
  SNACKS: [
    ...expand([
      { brand: "شيبسي",    product: "شيبس بطاطس بالملح",           sizes: ["١٤ جم", "٤٠ جم", "١٠٠ جم"], measure: MeasurementType.UNIT, desc: "شيبس بطاطس مقرمش بالملح من شيبسي" },
      { brand: "شيبسي",    product: "شيبس بطاطس بالكاتشب",        sizes: ["١٤ جم", "٤٠ جم"],           measure: MeasurementType.UNIT, desc: "شيبس بطاطس بنكهة الكاتشب من شيبسي" },
      { brand: "دوريتوس",  product: "شيبس ذرة بالجبنة",            sizes: ["٥٥ جم", "١٧٠ جم"],          measure: MeasurementType.UNIT, desc: "شيبس ذرة مثلثات بنكهة الجبنة من دوريتوس" },
      { brand: "تشيتوس",   product: "شيبس ذرة بالجبنة",            sizes: ["٤٠ جم"],                    measure: MeasurementType.UNIT, desc: "شيبس ذرة كرانشي بنكهة الجبنة من تشيتوس" },
      { brand: "كرانشي",   product: "شيبس ذرة مقرمش",              sizes: ["٤٠ جم"],                    measure: MeasurementType.UNIT, desc: "شيبس ذرة مقرمش بنكهة الجبنة من كرانشي" },
      { brand: "فريسكا",   product: "شيبس بطاطس",                  sizes: ["٣٥ جم"],                    measure: MeasurementType.UNIT, desc: "شيبس بطاطس مقرمش من فريسكا" },
      { brand: "بسكو مصر", product: "بسكويت شاي سادة",             sizes: ["١٠٠ جم", "٣٠٠ جم"],         measure: MeasurementType.UNIT, desc: "بسكويت شاي سادة مقرمش من بسكو مصر" },
      { brand: "بسكو مصر", product: "بسكويت مالح بالجبنة",        sizes: ["١٠٠ جم"],                    measure: MeasurementType.UNIT, desc: "بسكويت مالح مقرمش بنكهة الجبنة من بسكو مصر" },
      { brand: "مولتو",    product: "كرواسون بالشوكولاتة",        sizes: ["قطعة ٤٥ جم", "علبة ٦ قطع"], measure: MeasurementType.UNIT, desc: "كرواسون طري محشو بكريمة الشوكولاتة من مولتو" },
      { brand: "مولتو",    product: "كرواسون بالفانيليا",         sizes: ["قطعة ٤٥ جم"],                measure: MeasurementType.UNIT, desc: "كرواسون طري محشو بكريمة الفانيليا من مولتو" },
      { brand: "توداي",    product: "كيك بالشوكولاتة",             sizes: ["قطعة ٣٠ جم", "علبة ٦ قطع"], measure: MeasurementType.UNIT, desc: "كيك إسفنجي بالشوكولاتة فردي من توداي" },
      { brand: "بيك رولز", product: "مقرمشات دقيق محشوة بالجبنة", sizes: ["٣٠ جم"],                    measure: MeasurementType.UNIT, desc: "مقرمشات دقيق محشوة بكريمة الجبنة من بيك رولز" },
      { brand: "هوهوز",    product: "كيك ملفوف بالكاكاو",          sizes: ["قطعتين ٤٠ جم"],              measure: MeasurementType.UNIT, desc: "كيك إسفنجي ملفوف بكريمة الكاكاو من هوهوز" },
      { brand: "كورونا",   product: "شوكولاتة لبن",                sizes: ["٣٥ جم", "١٠٠ جم"],          measure: MeasurementType.UNIT, desc: "شوكولاتة لبن كريمية من كورونا" },
      { brand: "كورونا",   product: "ويفر بالشوكولاتة",           sizes: ["٣٠ جم"],                    measure: MeasurementType.UNIT, desc: "ويفر مقرمش بطبقات الشوكولاتة من كورونا" },
      { brand: "كادبوري",  product: "شوكولاتة ديري ميلك",          sizes: ["٣٧ جم", "٨٠ جم"],           measure: MeasurementType.UNIT, desc: "شوكولاتة لبن كريمية من كادبوري" },
      { brand: "جالاكسي",  product: "شوكولاتة لبن",                sizes: ["٣٦ جم"],                    measure: MeasurementType.UNIT, desc: "شوكولاتة لبن ناعمة القوام من جالاكسي" },
      { brand: "تويكس",    product: "بسكويت بالكراميل والشوكولاتة", sizes: ["إصبعين ٥٠ جم"],           measure: MeasurementType.UNIT, desc: "أصابع بسكويت مغطاة بالكراميل والشوكولاتة من تويكس" },
      { brand: "كيت كات",  product: "ويفر بالشوكولاتة",            sizes: ["٤ أصابع ٤١.٥ جم"],          measure: MeasurementType.UNIT, desc: "ويفر مقرمش مغطى بالشوكولاتة من كيت كات" },
      { brand: "المراعي",  product: "كورن فليكس رقائق ذرة",        sizes: ["٣٧٥ جم"],                   measure: MeasurementType.UNIT, desc: "رقائق ذرة مقرمشة للفطار بالحليب من المراعي" },
    ]),
    ...sized("فشار مورق",    "فشار مورق خفيف محمص بزبدة الفشار",  ["٩٠ جم"], MeasurementType.UNIT),
    ...sized("جيلي ملون",    "حلوى جيلي ناعمة ملونة بنكهات الفاكهة", ["٨٠ جم"], MeasurementType.UNIT),
    { name: "شيبس عدس",     description: "شيبس عدس خفيف ومقرمش غني بالبروتين",  measure: MeasurementType.UNIT },
    { name: "حلوى صابلية",  description: "حلوى صابلية هشة بالزبدة والسكر",       measure: MeasurementType.UNIT },
    { name: "حلاوة طحينية", description: "حلاوة طحينية قطعة بالسمسم والفانيليا", measure: MeasurementType.WEIGHT },
  ],

  // ── Roastery: nuts, seeds, dried fruits, ground coffee (mostly loose) ─────
  ROASTERY: [
    { name: "لب سوبر محمص",           description: "لب دوار الشمس سوبر محمص بالملح",           measure: MeasurementType.WEIGHT },
    { name: "لب أبيض (حب البطيخ)",    description: "بذور البطيخ البيضاء محمصة ومملحة",          measure: MeasurementType.WEIGHT },
    { name: "فستق حلبي محمص",         description: "فستق حلبي أخضر محمص ومملح فاخر",           measure: MeasurementType.WEIGHT },
    { name: "لوز محمص",               description: "لوز أبيض مقشور محمص بالملح الخشن",        measure: MeasurementType.WEIGHT },
    { name: "فول سوداني محمص",        description: "فول سوداني محمص مقشور بالملح",             measure: MeasurementType.WEIGHT },
    { name: "كاجو محمص",              description: "كاجو هندي محمص وخالٍ من القشرة",           measure: MeasurementType.WEIGHT },
    { name: "بندق محمص",              description: "بندق تركي محمص ومقشور",                    measure: MeasurementType.WEIGHT },
    { name: "عين جمل",                description: "جوز عين جمل كامل مقشور للأكل المباشر",    measure: MeasurementType.WEIGHT },
    { name: "حمص مقلي",               description: "حمص مقلي مقرمش ومملح تسالي مصرية",        measure: MeasurementType.WEIGHT },
    { name: "قرع مملح",               description: "بذور القرع المحمصة والمملحة",              measure: MeasurementType.WEIGHT },
    { name: "ترمس مملح",              description: "ترمس مطبوخ ومملح تسالي شعبية",             measure: MeasurementType.WEIGHT },
    { name: "بسلة مقلية",             description: "بسلة خضراء مقلية ومقرمشة",                 measure: MeasurementType.WEIGHT },
    { name: "مكسرات مشكلة",           description: "خلطة مكسرات مشكلة محمصة فاخرة",            measure: MeasurementType.WEIGHT },
    { name: "زبيب أخضر",              description: "زبيب أخضر مجفف حلو لا بذور",              measure: MeasurementType.WEIGHT },
    { name: "تمر مجدول",              description: "تمر مجدول فاخر كبير الحجم رطب وشهي",      measure: MeasurementType.WEIGHT },
    { name: "تين مجفف",               description: "تين مجفف طبيعي حلو",                       measure: MeasurementType.WEIGHT },
    { name: "مشمش مجفف",              description: "مشمش مجفف برتقالي مذاق حامض وحلو",       measure: MeasurementType.WEIGHT },
    { name: "توت مجفف",               description: "توت أحمر أو أسود مجفف للسلطات والحلويات", measure: MeasurementType.WEIGHT },
    { name: "نعناع جاف",              description: "أوراق نعناع مجففة للشاي والزينة",          measure: MeasurementType.WEIGHT },
    { name: "بابونج جاف",             description: "زهور البابونج المجففة للشاي المهدئ",       measure: MeasurementType.WEIGHT },
    { name: "قهوة عربية مطحونة",      description: "قهوة عربية بالهيل مطحونة طازجة",          measure: MeasurementType.WEIGHT },
    { name: "قهوة تركية مطحونة",      description: "قهوة تركية ناعمة محمصة داكنة",             measure: MeasurementType.WEIGHT },
    { name: "قهوة سادة مطحونة",       description: "قهوة سادة خفيفة التحميص دون هيل",          measure: MeasurementType.WEIGHT },
  ],

  // ── Fresh beef & lamb (loose, priced per kg) ───────────────────────────────
  MEAT: [
    { name: "لحم بقري موزة",           description: "موزة بقري طازجة للكباب والشوي",             measure: MeasurementType.WEIGHT },
    { name: "لحم بقري مفروم",          description: "لحم بقري مفروم طازج خشن أو ناعم",          measure: MeasurementType.WEIGHT },
    { name: "لحم بقري كتف",            description: "كتف بقري بالعظم للطهي البطيء",             measure: MeasurementType.WEIGHT },
    { name: "لحم بقري ريش",            description: "ريش بقري عصيرية للشواء",                    measure: MeasurementType.WEIGHT },
    { name: "لحم بقري فيليه",          description: "فيليه بقري طري فاخر للشرائح",              measure: MeasurementType.WEIGHT },
    { name: "رقبة بقري",               description: "رقبة بقري بالعظم للشوربات واليخنة",        measure: MeasurementType.WEIGHT },
    { name: "كبدة بقري",               description: "كبدة بقري طازجة للتحمير والمقلي",          measure: MeasurementType.WEIGHT },
    { name: "كلاوي بقري",              description: "كلاوي بقري طازجة للمقلي",                  measure: MeasurementType.WEIGHT },
    { name: "لسان بقري",               description: "لسان بقري طازج للتبخير والطهي",            measure: MeasurementType.WEIGHT },
    { name: "كوارع بقري",               description: "كوارع بقري للكرشة والكوارع الشعبية",      measure: MeasurementType.WEIGHT },
    { name: "لحم ضاني مشكل",          description: "قطع ضاني مشكلة للطهي المتنوع",             measure: MeasurementType.WEIGHT },
    { name: "لحم ضاني مفروم",         description: "لحم ضاني مفروم طازج للكفتة والكباب",       measure: MeasurementType.WEIGHT },
    { name: "لحم ضاني كتف",           description: "كتف خروف بالعظم للفرن والشوي",             measure: MeasurementType.WEIGHT },
    { name: "لحم ضاني فخذ",           description: "فخذ خروف طازج بالعظم للفرن",               measure: MeasurementType.WEIGHT },
    { name: "ضلوع ضاني",              description: "ضلوع خروف طازجة للشواء والفرن",            measure: MeasurementType.WEIGHT },
    { name: "كبدة ضاني",              description: "كبدة خروف طازجة ذات طعم لطيف",            measure: MeasurementType.WEIGHT },
    { name: "سجق بلدي",               description: "سجق بقري بلدي مرتب بالتوابل",             measure: MeasurementType.WEIGHT },
    { name: "كفتة طازجة",             description: "كفتة لحم بلدي مرتبة جاهزة للشوي",         measure: MeasurementType.WEIGHT },
  ],

  // ── Fresh poultry (loose, priced per kg) ───────────────────────────────────
  POULTRY: [
    { name: "فراخ بيضاء كاملة",        description: "دجاجة بيضاء كاملة مذبوحة طازجة",           measure: MeasurementType.WEIGHT },
    { name: "صدور دجاج",               description: "صدور دجاج طازجة مشققة بلا جلد",           measure: MeasurementType.WEIGHT },
    { name: "أوراك دجاج",              description: "أوراك دجاج بالعظم طازجة دهنية",            measure: MeasurementType.WEIGHT },
    { name: "دبابيس دجاج",             description: "دبابيس دجاج طازجة للشواء والفرن",          measure: MeasurementType.WEIGHT },
    { name: "أجنحة دجاج",              description: "أجنحة دجاج طازجة للقلي والشواء",           measure: MeasurementType.WEIGHT },
    { name: "كبد وقوانص دجاج",         description: "كبد وقوانص دجاج طازجة للمقلي",            measure: MeasurementType.WEIGHT },
    { name: "دجاج متبل للشواء",        description: "دجاج متبل بتوابل محلية جاهز للشواء",       measure: MeasurementType.WEIGHT },
    { name: "مفروم دجاج",              description: "دجاج مفروم طازج للحشوات والكباب",          measure: MeasurementType.WEIGHT },
    { name: "دجاج بلدي كامل",          description: "دجاجة بلدية حرة المرعى طازجة المذبح",     measure: MeasurementType.WEIGHT },
    { name: "ديك رومي كامل",           description: "ديك رومي كامل طازج للمناسبات",             measure: MeasurementType.WEIGHT },
    { name: "بط كامل",                 description: "بطة كاملة مذبوحة طازجة للفرن",             measure: MeasurementType.WEIGHT },
    { name: "سمان",                    description: "طيور سمان مذبوحة طازجة كاملة",              measure: MeasurementType.WEIGHT },
  ],

  // ── Fresh produce — vegetables & fruit (loose, priced per kg) ─────────────
  VEG_FRUIT: [
    // ── Vegetables ─────────────────────────────────────────────────────────
    { name: "طماطم",                   description: "طماطم حمراء طازجة محلية موسمية",            measure: MeasurementType.WEIGHT },
    { name: "خيار بلدي",               description: "خيار بلدي أخضر طازج ومقرمش",               measure: MeasurementType.WEIGHT },
    { name: "بطاطس",                   description: "بطاطس بيضاء أو صفراء طازجة",               measure: MeasurementType.WEIGHT },
    { name: "بطاطا حلوة",              description: "بطاطا حلوة برتقالية اللون غنية بالفيتامينات", measure: MeasurementType.WEIGHT },
    { name: "بصل أحمر",                description: "بصل أحمر كبير حار النكهة",                 measure: MeasurementType.WEIGHT },
    { name: "بصل أبيض",                description: "بصل أبيض طازج خفيف الطعم",                 measure: MeasurementType.WEIGHT },
    { name: "ثوم بلدي",                description: "رؤوس ثوم بلدي مجدولة قوية النكهة",         measure: MeasurementType.WEIGHT },
    { name: "جزر",                     description: "جزر برتقالي طازج حلو المذاق",               measure: MeasurementType.WEIGHT },
    { name: "كوسة",                    description: "كوسة خضراء طازجة للمحاشي والطهي",           measure: MeasurementType.WEIGHT },
    { name: "باذنجان",                 description: "باذنجان أرجواني طازج للمسقعة والشوي",       measure: MeasurementType.WEIGHT },
    { name: "قرنبيط",                  description: "قرنبيط أبيض طازج للفرن والمقلي",           measure: MeasurementType.WEIGHT },
    { name: "ملفوف أبيض",              description: "كرنب أبيض طازج للسلطات والمحاشي",          measure: MeasurementType.WEIGHT },
    { name: "فاصوليا خضراء",           description: "فاصوليا خضراء طازجة للطهي بالزيت",         measure: MeasurementType.WEIGHT },
    { name: "بامية",                   description: "بامية خضراء طازجة صغيرة الحجم",            measure: MeasurementType.WEIGHT },
    { name: "فلفل أخضر",               description: "فلفل رومي أخضر طازج للحشو والطهي",        measure: MeasurementType.WEIGHT },
    { name: "فلفل رومي أحمر",          description: "فلفل رومي أحمر حلو طازج",                   measure: MeasurementType.WEIGHT },
    { name: "فلفل حار أخضر",           description: "فلفل حار أخضر صغير لاذع",                  measure: MeasurementType.WEIGHT },
    { name: "ملوخية طازجة",           description: "أوراق ملوخية خضراء طازجة للشوربة",         measure: MeasurementType.WEIGHT },
    { name: "سبانخ",                   description: "سبانخ أخضر طازج للسلطات والطبخ",           measure: MeasurementType.WEIGHT },
    { name: "خس أخضر",                 description: "خس رومان أخضر طازج للسلطات",               measure: MeasurementType.WEIGHT },
    { name: "جرجير",                   description: "جرجير أخضر حار للسلطات والتزيين",           measure: MeasurementType.WEIGHT },
    { name: "كراث",                    description: "كراث طازج أخضر للشوربات والتتبيلات",       measure: MeasurementType.WEIGHT },
    { name: "بقدونس طازج",             description: "بقدونس أخضر طازج للتتبيل والتزيين",        measure: MeasurementType.WEIGHT },
    { name: "كزبرة طازجة",             description: "كزبرة خضراء طازجة للشوربات والأطباق",      measure: MeasurementType.WEIGHT },
    { name: "نعناع طازج",              description: "نعناع أخضر طازج للشاي والسلطات",           measure: MeasurementType.WEIGHT },
    { name: "شبت طازج",                description: "شبت أخضر طازج للسمك والأطباق",             measure: MeasurementType.WEIGHT },
    { name: "شمندر أحمر",              description: "شمندر أحمر طازج للعصير والسلطات",          measure: MeasurementType.WEIGHT },
    { name: "ذرة شامية",               description: "كيزان ذرة طازجة صفراء حلوة",              measure: MeasurementType.WEIGHT },
    { name: "خرشوف",                   description: "خرشوف أخضر طازج بيضاوي الشكل",            measure: MeasurementType.WEIGHT },
    { name: "قلقاس",                   description: "قلقاس طازج للطبخ المصري التقليدي",         measure: MeasurementType.WEIGHT },
    { name: "لفت",                     description: "لفت أبيض طازج للمخلل والطبخ",              measure: MeasurementType.WEIGHT },
    // ── Fruits ─────────────────────────────────────────────────────────────
    { name: "موز",                     description: "موز أصفر ناضج حلو ومغذٍّ",                  measure: MeasurementType.WEIGHT },
    { name: "برتقال",                  description: "برتقال مصري أصفر حامض ومليء بالعصير",     measure: MeasurementType.WEIGHT },
    { name: "يوسف أفندي",              description: "يوسف أفندي برتقالي سهل القشر حلو",         measure: MeasurementType.WEIGHT },
    { name: "ليمون بلدي",              description: "ليمون أصفر بلدي حامض وعطري",               measure: MeasurementType.WEIGHT },
    { name: "تفاح أحمر",               description: "تفاح أحمر مقرمش وحلو",                     measure: MeasurementType.WEIGHT },
    { name: "تفاح أخضر",               description: "تفاح أخضر حامض ومنعش",                     measure: MeasurementType.WEIGHT },
    { name: "عنب أحمر",                description: "عنب أحمر بذور أو بدون بذور حلو",           measure: MeasurementType.WEIGHT },
    { name: "عنب أبيض",                description: "عنب أخضر ذهبي حلو وعصيري",                measure: MeasurementType.WEIGHT },
    { name: "فراولة",                  description: "فراولة حمراء طازجة حلوة وعطرية",           measure: MeasurementType.WEIGHT },
    { name: "مانجو",                   description: "مانجو مصرية ناضجة ذهبية",                   measure: MeasurementType.WEIGHT },
    { name: "بطيخ",                    description: "بطيخ أحمر كبير حلو الداخل",                 measure: MeasurementType.WEIGHT },
    { name: "شمام",                    description: "شمام أصفر مصري عطري وحلو",                  measure: MeasurementType.WEIGHT },
    { name: "جوافة",                   description: "جوافة بيضاء أو وردية عطرية",               measure: MeasurementType.WEIGHT },
    { name: "رمان",                    description: "رمان أحمر كبير غني بحبوب العصير",           measure: MeasurementType.WEIGHT },
    { name: "تين طازج",                description: "تين أسود أو أخضر طازج ناضج",               measure: MeasurementType.WEIGHT },
    { name: "مشمش",                    description: "مشمش برتقالي طازج حلو ومنعش",              measure: MeasurementType.WEIGHT },
    { name: "خوخ",                     description: "خوخ وردي طري عصيري ومنعش",                 measure: MeasurementType.WEIGHT },
    { name: "كمثرى",                   description: "كمثرى أصفر ناعم حلو المذاق",               measure: MeasurementType.WEIGHT },
    { name: "بلح رطب",                 description: "بلح أصفر أو أحمر رطب وشهي",               measure: MeasurementType.WEIGHT },
    { name: "أناناس",                  description: "أناناس كامل طازج أصفر اللب",               measure: MeasurementType.WEIGHT },
    { name: "كيوي",                    description: "كيوي نيوزيلندي أو إيطالي طازج",             measure: MeasurementType.WEIGHT },
    { name: "أفوكادو",                 description: "أفوكادو طازج مستورد غني بالدهون الصحية",  measure: MeasurementType.WEIGHT },
    { name: "توت أزرق",                description: "توت أزرق طازج مستورد",                      measure: MeasurementType.WEIGHT },
  ],

  // ── Fresh bread & bakery ───────────────────────────────────────────────────
  BAKERY: [
    { name: "عيش بلدي",                description: "رغيف بلدي طازج من الطحين الكامل",           measure: MeasurementType.UNIT },
    { name: "عيش فينو",                description: "خبز فينو طازج ناعم طويل",                   measure: MeasurementType.UNIT },
    { name: "عيش شمس",                 description: "خبز شمس منبوش طازج بالسمسم",               measure: MeasurementType.UNIT },
    ...sized("توست أبيض",       "رغيف توست أبيض متعدد الشرائح",   ["٣٥٠ جم", "٦٠٠ جم"], MeasurementType.UNIT),
    ...sized("توست أسمر",       "رغيف توست أسمر قمح كامل",         ["٣٥٠ جم", "٦٠٠ جم"], MeasurementType.UNIT),
    { name: "توست القمح الكامل",        description: "توست بالحبوب الكاملة صحي ومقوٍّ",           measure: MeasurementType.UNIT },
    { name: "كعك بالسمسم",             description: "كعك مصري بالسمسم والعسل إسكندراني",        measure: MeasurementType.UNIT },
    { name: "خبز صاج",                 description: "خبز صاج رفيع طازج للسندوتشات",             measure: MeasurementType.UNIT },
    { name: "فطير مشلتت",              description: "فطير مشلتت ورقي بالسمن البلدي",             measure: MeasurementType.UNIT },
    { name: "فطير سادة",               description: "فطير سادة محمر بالفرن أو التنور",           measure: MeasurementType.UNIT },
    { name: "كعك سادة",                description: "كعك دائري سادة خفيف وهشّ",                 measure: MeasurementType.UNIT },
    { name: "فطاير سبانخ",             description: "فطائر محشوة بالسبانخ والبصل والتوابل",     measure: MeasurementType.UNIT },
  ],

  // ── Oriental sweets & pastry (mostly loose/counter, priced per kg) ────────
  PASTRY: [
    { name: "بقلاوة",                  description: "بقلاوة شرقية بالفستق والعسل وعجين الفيلو",  measure: MeasurementType.WEIGHT },
    { name: "كنافة طازجة",             description: "كنافة شعر طازجة خفيفة بالسكر",             measure: MeasurementType.WEIGHT },
    { name: "كنافة بالجبنة",           description: "كنافة محشوة بالجبنة المطبوخة والعسل",      measure: MeasurementType.WEIGHT },
    { name: "بسبوسة",                  description: "بسبوسة سميد بالجوز وعسل الكريم كراميل",    measure: MeasurementType.WEIGHT },
    { name: "قطايف",                   description: "قطايف محشوة بالمكسرات أو الكريمة",         measure: MeasurementType.WEIGHT },
    { name: "حلاوة الشعيبية",         description: "حلوى شعيبية هشّة بالمكسرات والعسل",        measure: MeasurementType.WEIGHT },
    { name: "مبروم",                   description: "مبروم بالقشطة والمكسرات لفافة عطرية",      measure: MeasurementType.WEIGHT },
    { name: "غريبة",                   description: "غريبة زبدة هشّة بالسمن والسكر البودرة",    measure: MeasurementType.WEIGHT },
    { name: "حلاوة بالقشطة",           description: "حلاوة ناعمة بالقشطة الطازجة والعسل",       measure: MeasurementType.WEIGHT },
    { name: "كاتو إسفنجي",             description: "كاتو إسفنجي طري بالفانيليا أو الشوكولاتة", measure: MeasurementType.WEIGHT },
    { name: "لقيمات",                  description: "لقيمات ذهبية بالعسل مقرمشة الخارج",        measure: MeasurementType.UNIT },
    { name: "عوامة",                   description: "عوامة مقلية بالشيرة والعسل جاهزة",         measure: MeasurementType.UNIT },
    { name: "بلح الشام",               description: "بلح الشام مقلي ناعم بالعسل",               measure: MeasurementType.UNIT },
    { name: "زلابية",                  description: "زلابية مقلية مقرمشة بالشيرة",              measure: MeasurementType.UNIT },
    { name: "مهلبية",                  description: "مهلبية بالحليب والسكر والعرق سوس",          measure: MeasurementType.UNIT },
    { name: "أرز بلبن",                description: "أرز بلبن كريمي بالقرفة والمكسرات",         measure: MeasurementType.UNIT },
    { name: "أم علي",                  description: "أم علي دافئة بالمكسرات والقشطة والسكر",    measure: MeasurementType.UNIT },
    { name: "سنيورة",                  description: "سنيورة بالمكسرات والعسل",                  measure: MeasurementType.WEIGHT },
  ],

  // ── Fresh fish & seafood (Alexandria / Mediterranean market, loose) ───────
  FISH: [
    { name: "سمك بلطي طازج",           description: "بلطي نيلي طازج كامل أو مشقق",              measure: MeasurementType.WEIGHT },
    { name: "فيليه بلطي",              description: "فيليه بلطي مقطع بلا عظم طازج",             measure: MeasurementType.WEIGHT },
    { name: "سمك بوري طازج",           description: "بوري بحري طازج متوسط الحجم",               measure: MeasurementType.WEIGHT },
    { name: "سمك دنيس",                description: "سمك دنيس متوسط طازج للشواء والفرن",        measure: MeasurementType.WEIGHT },
    { name: "سمك قاروص",               description: "سمك قاروص أبيض كبير للأطباق الفاخرة",     measure: MeasurementType.WEIGHT },
    { name: "سمك موسى",                description: "سمك موسى مسطح طازج للقلي",                  measure: MeasurementType.WEIGHT },
    { name: "سمك إسكمبري",            description: "إسكمبري بلدي طازج سريع الطهي",              measure: MeasurementType.WEIGHT },
    { name: "تونة طازجة",              description: "تونة حمراء طازجة للشرائح والشواء",          measure: MeasurementType.WEIGHT },
    { name: "سمك سردين",               description: "سردين طازج صغير للقلي والمشوي",            measure: MeasurementType.WEIGHT },
    { name: "سمك سالمون طازج",        description: "فيليه سالمون طازج مستورد",                 measure: MeasurementType.WEIGHT },
    { name: "جمبري وسط",               description: "جمبري وسط طازج للقلي والشوي",              measure: MeasurementType.WEIGHT },
    { name: "جمبري كبير",              description: "جمبري تايجر كبير طازج للمناسبات",           measure: MeasurementType.WEIGHT },
    { name: "كابوريا طازجة",           description: "كابوريا بحر متوسطي طازجة كاملة",           measure: MeasurementType.WEIGHT },
    { name: "استاكوزا طازجة",         description: "استاكوزا بحرية طازجة فاخرة",               measure: MeasurementType.WEIGHT },
    { name: "سبيط",                    description: "سبيط (حبار) طازج للشواء والطهي",            measure: MeasurementType.WEIGHT },
    { name: "أخطبوط",                  description: "أخطبوط طازج للشوي والأطباق المتوسطية",     measure: MeasurementType.WEIGHT },
    { name: "سلطعون",                  description: "سلطعون بحري صغير طازج",                     measure: MeasurementType.WEIGHT },
    { name: "فسيخ",                    description: "فسيخ مملح تقليدي موسم شم النسيم",          measure: MeasurementType.WEIGHT },
    { name: "رنجة مدخنة",              description: "رنجة مدخنة ذهبية الحجم الكبير",            measure: MeasurementType.WEIGHT },
    { name: "ملوحة بوري",              description: "بوري مملح جاف للأطباق الإسكندرانية",      measure: MeasurementType.WEIGHT },
    { name: "بياض بوري (بطارخ)",      description: "بطارخ بوري مجففة فاخرة مقطعة",             measure: MeasurementType.WEIGHT },
  ],

  // ── Frozen foods ───────────────────────────────────────────────────────────
  FROZEN: [
    ...expand([
      { brand: "أمريكانا", product: "بطاطس مجمدة أصابع",        sizes: ["٤٠٠ جم", "٩٠٠ جم"],   measure: MeasurementType.UNIT, desc: "بطاطس مجمدة مقطعة أصابع للقلي والفرن من أمريكانا" },
      { brand: "أمريكانا", product: "خضروات مجمدة مشكلة",       sizes: ["٤٠٠ جم"],              measure: MeasurementType.UNIT, desc: "خلطة خضروات مجمدة جزر وذرة وبازلاء من أمريكانا" },
      { brand: "أمريكانا", product: "كفتة مجمدة",                sizes: ["٤٠٠ جم"],              measure: MeasurementType.UNIT, desc: "أصابع كفتة لحم مجمدة جاهزة للشواء من أمريكانا" },
      { brand: "أمريكانا", product: "برجر لحم مجمد",             sizes: ["٤ أقراص ٤٠٠ جم"],      measure: MeasurementType.UNIT, desc: "أقراص برجر لحم بقري مجمدة من أمريكانا" },
      { brand: "أمريكانا", product: "سمبوسك مجمد بالجبنة",      sizes: ["٣٠٠ جم"],              measure: MeasurementType.UNIT, desc: "سمبوسك محشو بالجبنة مجمد جاهز للقلي من أمريكانا" },
      { brand: "أمريكانا", product: "محشي كرنب مجمد",            sizes: ["٤٠٠ جم"],              measure: MeasurementType.UNIT, desc: "لفائف كرنب محشي مجمدة جاهزة للطهي من أمريكانا" },
      { brand: "سديا",     product: "صدور دجاج مجمدة",           sizes: ["٩٠٠ جم"],              measure: MeasurementType.UNIT, desc: "صدور دجاج مجمدة بلا جلد وبلا عظم من سديا" },
      { brand: "سديا",     product: "دجاج مجمد كامل",            sizes: ["١ كجم"],               measure: MeasurementType.UNIT, desc: "دجاجة كاملة مجمدة مذبوحة ومنظفة من سديا" },
      { brand: "سديا",     product: "برجر دجاج مجمد",            sizes: ["٤ أقراص ٣٦٠ جم"],      measure: MeasurementType.UNIT, desc: "أقراص برجر دجاج مجمدة جاهزة للقلي من سديا" },
    ]),
    { name: "بازلاء مجمدة",            description: "بازلاء خضراء مجمدة كاملة الحبة",          measure: MeasurementType.UNIT },
    { name: "ذرة مجمدة",               description: "حبوب ذرة صفراء مجمدة حلوة",               measure: MeasurementType.UNIT },
    { name: "جمبري مجمد",              description: "جمبري مجمد مقشور أو كامل القشرة",         measure: MeasurementType.UNIT },
    { name: "سمك فيليه مجمد",          description: "فيليه سمك أبيض مجمد بلا عظم",             measure: MeasurementType.UNIT },
  ],

  // ── Household cleaning ─────────────────────────────────────────────────────
  CLEANING: [
    ...expand([
      { brand: "أريال",     product: "مسحوق غسيل أوتوماتيك",        sizes: ["١ كجم", "٢.٥ كجم", "٦ كجم"], measure: MeasurementType.UNIT, desc: "مسحوق غسيل قوي للغسالات الأوتوماتيك من أريال" },
      { brand: "برسيل",     product: "مسحوق غسيل يدوي وأوتوماتيك",  sizes: ["١ كجم", "٢.٥ كجم", "٦ كجم"], measure: MeasurementType.UNIT, desc: "مسحوق غسيل قوي للملابس من برسيل" },
      { brand: "تايد",      product: "مسحوق غسيل أوتوماتيك",        sizes: ["١.٥ كجم", "٤ كجم"],          measure: MeasurementType.UNIT, desc: "مسحوق غسيل بقوة إزالة البقع من تايد" },
      { brand: "برسيل",     product: "سائل غسيل ملابس",             sizes: ["١ لتر", "٢ لتر"],            measure: MeasurementType.UNIT, desc: "سائل غسيل مركز للأقمشة الحساسة من برسيل" },
      { brand: "فيري",      product: "سائل غسيل أطباق",             sizes: ["٥٠٠ مل", "١ لتر", "١.٨ لتر"], measure: MeasurementType.UNIT, desc: "سائل جلي مركز لتنظيف الأطباق والمطبخ من فيري" },
      { brand: "فينيش",     product: "أقراص غسالة أطباق",           sizes: ["١٦ قرص", "٣٦ قرص"],           measure: MeasurementType.UNIT, desc: "أقراص جل لغسالات الأطباق الأوتوماتيك من فينيش" },
      { brand: "بريل",      product: "منظف حمامات مطهر",            sizes: ["٧٥٠ مل"],                    measure: MeasurementType.UNIT, desc: "منظف حمامات مضاد للترسبات والبكتيريا من بريل" },
      { brand: "بريل",      product: "منظف أرضيات",                 sizes: ["١ لتر"],                     measure: MeasurementType.UNIT, desc: "منظف مطهر للأرضيات بعطر منعش من بريل" },
      { brand: "كلوروكس",   product: "كلور مطهر ومبيض",             sizes: ["١ لتر", "١.٨٩ لتر"],         measure: MeasurementType.UNIT, desc: "محلول كلور مركز للتطهير والتبييض من كلوروكس" },
      { brand: "فانيش",     product: "مزيل بقع للملابس",            sizes: ["٤٥٠ مل"],                    measure: MeasurementType.UNIT, desc: "مزيل بقع قوي للأقمشة الملونة من فانيش" },
      { brand: "رايد",      product: "بخاخ مبيد حشرات طائرة وزاحفة", sizes: ["٣٠٠ مل"],                    measure: MeasurementType.UNIT, desc: "بخاخ مبيد حشرات سريع المفعول من رايد" },
      { brand: "اير ويك",   product: "معطر جو بخاخ",                sizes: ["٣٠٠ مل"],                    measure: MeasurementType.UNIT, desc: "معطر هواء منعش برائحة الورد أو الياسمين من اير ويك" },
    ]),
    ...sized("منعم ملابس",   "منعم ملابس بعطر الربيع للغسيل",       ["١ لتر", "١.٥ لتر"], MeasurementType.UNIT),
    { name: "صابون سائل للأطباق",      description: "جلي سائل مركز لتنظيف الأطباق والمطبخ",    measure: MeasurementType.UNIT },
    { name: "منظف أرضيات",             description: "منظف مطهر للأرضيات بعطر الليمون",          measure: MeasurementType.UNIT },
    { name: "منظف حمامات",             description: "منظف حمامات مضاد للترسبات والبكتيريا",    measure: MeasurementType.UNIT },
    { name: "كلور مطهر",               description: "محلول كلور مركز للتطهير والتبييض",         measure: MeasurementType.UNIT },
    { name: "معطر جو",                 description: "معطر هواء برائحة الورد أو الياسمين",        measure: MeasurementType.UNIT },
    { name: "مبيد حشرات",              description: "بخاخ مبيد حشرات للمنازل سريع المفعول",     measure: MeasurementType.UNIT },
    { name: "إسفنجة جلي",             description: "إسفنجة تنظيف مزدوجة الوجه للمطبخ",        measure: MeasurementType.UNIT },
    { name: "ليفة تنظيف معدنية",       description: "ليفة مجدولة معدنية للأواني الصعبة",        measure: MeasurementType.UNIT },
    { name: "غسول الصحون الجافة",      description: "مسحوق جلي الصحون للغسالة الآلية",         measure: MeasurementType.UNIT },
  ],

  // ── Paper products: toilet paper, tissues, kitchen towels ──────────────────
  PAPER: [
    ...expand([
      { brand: "فاين",    product: "مناديل تواليت",          sizes: ["٤ لفات", "١٠ لفات", "٣٢ لفة"], measure: MeasurementType.UNIT, desc: "مناديل تواليت بيضاء ناعمة متعددة الطبقات من فاين" },
      { brand: "فاين",    product: "مناديل ورقية للوجه",    sizes: ["١٥٠ منديل", "٢×١٥٠ منديل"],   measure: MeasurementType.UNIT, desc: "مناديل ورقية ناعمة للوجه والمائدة من فاين" },
      { brand: "فاين",    product: "فوط مطبخ ورقية",        sizes: ["لفتين", "٤ لفات"],             measure: MeasurementType.UNIT, desc: "فوط مطبخ ورقية قوية وماصة من فاين" },
      { brand: "فاين",    product: "مناديل مبللة للتنظيف", sizes: ["٨٠ منديل"],                    measure: MeasurementType.UNIT, desc: "مناديل مبللة مُطهرة للاستخدام المنزلي من فاين" },
      { brand: "كلينكس",  product: "مناديل ورقية للوجه",    sizes: ["١٥٠ منديل"],                   measure: MeasurementType.UNIT, desc: "مناديل ورقية فاخرة ناعمة من كلينكس" },
      { brand: "كلينكس",  product: "مناديل تواليت",          sizes: ["١٠ لفات"],                     measure: MeasurementType.UNIT, desc: "مناديل تواليت ناعمة ثلاثية الطبقات من كلينكس" },
      { brand: "سوفتكس",  product: "مناديل تواليت",          sizes: ["٤ لفات", "١٠ لفات"],           measure: MeasurementType.UNIT, desc: "مناديل تواليت اقتصادية من سوفتكس" },
    ]),
  ],

  // ── Personal care: hygiene, oral care, shaving & OTC pharmacy ──────────────
  PERSONAL_CARE: [
    ...expand([
      { brand: "نيفيا",           product: "مزيل عرق رول",             sizes: ["٥٠ مل"],                      measure: MeasurementType.UNIT, desc: "مزيل عرق رول 48 ساعة بلا كحول من نيفيا" },
      { brand: "نيفيا",           product: "غسول استحمام",             sizes: ["٢٥٠ مل", "٥٠٠ مل"],           measure: MeasurementType.UNIT, desc: "جل استحمام كريمي مرطب من نيفيا" },
      { brand: "ريكسونا",         product: "مزيل عرق بخاخ",            sizes: ["١٥٠ مل"],                     measure: MeasurementType.UNIT, desc: "مزيل عرق سبراي 48 ساعة بعطر منعش من ريكسونا" },
      { brand: "فا",              product: "صابون استحمام",            sizes: ["١٢٥ جم"],                     measure: MeasurementType.UNIT, desc: "صابون صلب لتنظيف الجسم بعطر منعش من فا" },
      { brand: "دوف",             product: "صابون استحمام كريمي",      sizes: ["١٠٠ جم", "١٢٥ جم"],           measure: MeasurementType.UNIT, desc: "صابون كريمي مرطب للبشرة من دوف" },
      { brand: "لوكس",            product: "صابون استحمام",            sizes: ["١٢٥ جم"],                     measure: MeasurementType.UNIT, desc: "صابون فاخر معطر لبشرة ناعمة من لوكس" },
      { brand: "بالموليف",        product: "جل استحمام",               sizes: ["٢٥٠ مل", "٥٠٠ مل"],           measure: MeasurementType.UNIT, desc: "جل استحمام كريمي بعطر الخزامى من بالموليف" },
      { brand: "بالموليف",        product: "صابون سائل لليدين",        sizes: ["٣٠٠ مل"],                     measure: MeasurementType.UNIT, desc: "صابون سائل مطهر لليدين من بالموليف" },
      { brand: "كولجيت",          product: "معجون أسنان تألق كامل",    sizes: ["٧٥ مل", "١٢٥ مل"],            measure: MeasurementType.UNIT, desc: "معجون أسنان بالفلورايد لتبييض الأسنان من كولجيت" },
      { brand: "سيجنال",          product: "معجون أسنان للعناية الكاملة", sizes: ["٧٥ مل", "١٢٥ مل"],         measure: MeasurementType.UNIT, desc: "معجون أسنان يحمي من التسوس من سيجنال" },
      { brand: "كلوز أب",         product: "معجون أسنان بالجل",        sizes: ["٧٥ مل", "١٢٥ مل"],            measure: MeasurementType.UNIT, desc: "معجون أسنان بالجل المنعش من كلوز أب" },
      { brand: "سنسوداين",        product: "معجون أسنان للأسنان الحساسة", sizes: ["٧٥ مل"],                  measure: MeasurementType.UNIT, desc: "معجون أسنان مخصص للأسنان الحساسة من سنسوداين" },
      { brand: "كولجيت",          product: "فرشاة أسنان متوسطة",       sizes: ["فرشاة واحدة"],               measure: MeasurementType.UNIT, desc: "فرشاة أسنان بشعيرات متوسطة من كولجيت" },
      { brand: "جيليت",           product: "شفرة حلاقة رجالي",         sizes: ["شفرة واحدة", "عبوة ٤ شفرات"], measure: MeasurementType.UNIT, desc: "شفرة حلاقة رجالي متعددة الشفرات من جيليت" },
      { brand: "جيليت",           product: "كريم حلاقة",               sizes: ["١٩٥ جم"],                     measure: MeasurementType.UNIT, desc: "كريم حلاقة مرطب يُليّن الشعر من جيليت" },
    ]),
    { name: "قطن طبي",                  description: "قطن طبي أبيض نقي للجروح والعناية",        measure: MeasurementType.UNIT },
    { name: "ضمادات طبية",              description: "ضمادات جروح لاصقة مُعقمة مقاسات مختلفة", measure: MeasurementType.UNIT },
    { name: "محلول مطهر",              description: "محلول مطهر ومضاد للبكتيريا للجروح",        measure: MeasurementType.UNIT },
    { name: "مسكن ألم أقراص",          description: "أقراص مسكنة وخافضة للحرارة للبالغين",     measure: MeasurementType.UNIT },
    { name: "فيتامين سي أقراص",        description: "أقراص فيتامين C 500mg لتعزيز المناعة",    measure: MeasurementType.UNIT },
    { name: "مناديل مبللة للكبار",      description: "مناديل مبللة مُطهرة للاستخدام الشخصي",   measure: MeasurementType.UNIT },
  ],

  // ── Beauty: hair care, skincare, sun protection & cosmetics ────────────────
  BEAUTY: [
    ...expand([
      { brand: "بانتين",          product: "شامبو للشعر الجاف والتالف", sizes: ["٢٠٠ مل", "٤٠٠ مل", "٦٠٠ مل"], measure: MeasurementType.UNIT, desc: "شامبو مرطب وترميمي للشعر الجاف من بانتين" },
      { brand: "بانتين",          product: "بلسم مغذي للشعر",           sizes: ["٢٠٠ مل", "٤٠٠ مل"],           measure: MeasurementType.UNIT, desc: "بلسم مرطب لتسهيل تمشيط الشعر من بانتين" },
      { brand: "هيد آند شولدرز",  product: "شامبو مضاد للقشرة",        sizes: ["٢٠٠ مل", "٤٠٠ مل", "٦٠٠ مل"], measure: MeasurementType.UNIT, desc: "شامبو يقضي على القشرة من أول استخدام" },
      { brand: "سانسيلك",         product: "شامبو للشعر العادي",       sizes: ["٢٠٠ مل", "٤٠٠ مل"],           measure: MeasurementType.UNIT, desc: "شامبو يومي للشعر العادي يُنظف ويُلمع من سانسيلك" },
      { brand: "دوف",             product: "شامبو مغذي",               sizes: ["٢٠٠ مل", "٤٠٠ مل"],           measure: MeasurementType.UNIT, desc: "شامبو مغذٍّ بزيوت طبيعية من دوف" },
      { brand: "نيفيا",           product: "كريم ترطيب للبشرة",        sizes: ["٥٠ مل", "١٥٠ مل", "٤٠٠ مل"],  measure: MeasurementType.UNIT, desc: "كريم مرطب للبشرة الجافة يومي وليلي من نيفيا" },
      { brand: "نيفيا",           product: "لوشن مرطب للجسم",          sizes: ["٢٥٠ مل", "٤٠٠ مل"],           measure: MeasurementType.UNIT, desc: "لوشن مرطب سريع الامتصاص لبشرة ناعمة من نيفيا" },
      { brand: "نيفيا",           product: "واقي شمس للوجه والجسم",   sizes: ["١٧٥ مل"],                     measure: MeasurementType.UNIT, desc: "كريم واقي شمس SPF50 للوجه والجسم من نيفيا" },
      { brand: "دابر أملا",       product: "زيت شعر للتغذية واللمعان", sizes: ["٢٠٠ مل"],                     measure: MeasurementType.UNIT, desc: "زيت طبيعي لتغذية الشعر وإصلاح الأطراف من دابر أملا" },
      { brand: "لوريال",          product: "صبغة شعر دائمة",           sizes: ["علبة واحدة"],                 measure: MeasurementType.UNIT, desc: "صبغة شعر دائمة بتغطية كاملة للشيب من لوريال" },
      { brand: "أكس",             product: "مزيل عرق بخاخ رجالي",      sizes: ["١٥٠ مل"],                     measure: MeasurementType.UNIT, desc: "بخاخ عطري منعش طويل المفعول من أكس" },
      { brand: "لاكوست",          product: "عطر رجالي",                sizes: ["١٠٠ مل"],                     measure: MeasurementType.UNIT, desc: "عطر رجالي منعش يدوم طويلاً من لاكوست" },
    ]),
    { name: "كريم لليدين",              description: "كريم مرطب مغذٍّ للأيدي الجافة",           measure: MeasurementType.UNIT },
    { name: "مناديل مزيلة للمكياج",    description: "مناديل مبللة لطيفة لإزالة المكياج",       measure: MeasurementType.UNIT },
    { name: "طلاء أظافر",               description: "طلاء أظافر لامع بألوان متعددة",           measure: MeasurementType.UNIT },
  ],

  // ── Baby products ──────────────────────────────────────────────────────────
  BABY: [
    ...expand([
      { brand: "بامبرس",  product: "حفاضات مقاس ٣ (٤-٩ كجم)",  sizes: ["٢٠ حفاضة", "٤٤ حفاضة"], measure: MeasurementType.UNIT, desc: "حفاضات فائقة الامتصاص مقاس ٣ من بامبرس" },
      { brand: "بامبرس",  product: "حفاضات مقاس ٤ (٧-١٤ كجم)", sizes: ["٢٠ حفاضة", "٤٠ حفاضة"], measure: MeasurementType.UNIT, desc: "حفاضات فائقة الامتصاص مقاس ٤ من بامبرس" },
      { brand: "بامبرس",  product: "حفاضات مقاس ٥ (١١-٢٥ كجم)", sizes: ["١٦ حفاضة", "٣٦ حفاضة"], measure: MeasurementType.UNIT, desc: "حفاضات فائقة الامتصاص مقاس ٥ من بامبرس" },
      { brand: "بامبرس",  product: "مناشف رطبة للأطفال",       sizes: ["٥٦ منشفة", "٨٠ منشفة"],  measure: MeasurementType.UNIT, desc: "مناشف رطبة معطرة لتنظيف بشرة الرضع من بامبرس" },
      { brand: "هجيز",    product: "حفاضات مقاس ٤ (٧-١٨ كجم)", sizes: ["٢٠ حفاضة", "٤٤ حفاضة"], measure: MeasurementType.UNIT, desc: "حفاضات فائقة النعومة مقاس ٤ من هجيز" },
      { brand: "بيبي جوي", product: "حفاضات مقاس ٣ (٤-٩ كجم)", sizes: ["٢٢ حفاضة", "٥٠ حفاضة"], measure: MeasurementType.UNIT, desc: "حفاضات اقتصادية مقاس ٣ من بيبي جوي" },
      { brand: "بيبي جوي", product: "حفاضات مقاس ٤ (٧-١٤ كجم)", sizes: ["٢٢ حفاضة", "٥٠ حفاضة"], measure: MeasurementType.UNIT, desc: "حفاضات اقتصادية مقاس ٤ من بيبي جوي" },
      { brand: "بيبي جوي", product: "كريم حفاضات",              sizes: ["١٢٥ مل"],                measure: MeasurementType.UNIT, desc: "كريم واقٍ من التهيج وطفح الحفاضات من بيبي جوي" },
      { brand: "بيبيلاك", product: "حليب أطفال مجفف مرحلة ٢",   sizes: ["٤٠٠ جم", "٩٠٠ جم"],      measure: MeasurementType.UNIT, desc: "حليب مجفف اصطناعي لتغذية الرضع من بيبيلاك" },
      { brand: "نان",     product: "حليب أطفال مجفف مرحلة ١",   sizes: ["٤٠٠ جم", "٨٠٠ جم"],      measure: MeasurementType.UNIT, desc: "حليب أطفال مجفف للرضع من نستله نان" },
      { brand: "سيميلاك", product: "حليب أطفال مجفف مرحلة ٢",   sizes: ["٤٠٠ جم"],                measure: MeasurementType.UNIT, desc: "حليب أطفال مجفف من سيميلاك" },
      { brand: "سيريلاك", product: "غذاء أطفال بالحبوب والفاكهة", sizes: ["١٧٥ جم"],              measure: MeasurementType.UNIT, desc: "حبوب دقيق أطفال سريعة التحضير بالفاكهة من سيريلاك" },
      { brand: "جونسون",  product: "شامبو أطفال بدون دموع",    sizes: ["٢٠٠ مل", "٥٠٠ مل"],      measure: MeasurementType.UNIT, desc: "شامبو أطفال لطيف على العين من جونسون" },
      { brand: "جونسون",  product: "زيت أطفال",                 sizes: ["٢٠٠ مل"],                measure: MeasurementType.UNIT, desc: "زيت رضع خفيف للتدليك واليدين من جونسون" },
      { brand: "جونسون",  product: "بودرة أطفال",               sizes: ["٢٠٠ جم"],                measure: MeasurementType.UNIT, desc: "بودرة زلق ناعمة للبشرة لحماية الطية من جونسون" },
    ]),
    { name: "غذاء أطفال معلب",         description: "أغذية أطفال معلبة بالخضروات والفاكهة",   measure: MeasurementType.UNIT },
  ],

  // ── Pet food & supplies ────────────────────────────────────────────────────
  PET: [
    ...expand([
      { brand: "ويسكاس",  product: "طعام قطط جاف بالسمك",   sizes: ["٥٠٠ جم", "١.١ كجم", "٣ كجم"], measure: MeasurementType.UNIT, desc: "طعام قطط جاف متكامل بنكهة السمك من ويسكاس" },
      { brand: "ويسكاس",  product: "طعام قطط رطب بالتونة",  sizes: ["٨٥ جم"],                       measure: MeasurementType.UNIT, desc: "طعام قطط رطب بقطع التونة في الصلصة من ويسكاس" },
      { brand: "بديجري",  product: "طعام كلاب جاف باللحم",  sizes: ["١.٥ كجم", "٣ كجم"],            measure: MeasurementType.UNIT, desc: "طعام كلاب جاف متكامل بنكهة اللحم من بديجري" },
      { brand: "بديجري",  product: "طعام كلاب رطب باللحم",  sizes: ["١٣٠ جم"],                      measure: MeasurementType.UNIT, desc: "طعام كلاب رطب بقطع اللحم في الصلصة من بديجري" },
    ]),
    ...sized("رمل قطط معطر",     "رمل قطط ماص للرطوبة ومزيل للروائح",       ["٥ لتر", "١٠ لتر"], MeasurementType.UNIT),
    ...sized("حبوب طيور مشكلة", "خلطة حبوب متكاملة لتغذية الطيور المنزلية", ["٥٠٠ جم", "١ كجم"], MeasurementType.UNIT),
  ],

  // ── Kitchen supplies & disposables ─────────────────────────────────────────
  KITCHEN: [
    ...sized("ورق ألومنيوم",              "ورق ألومنيوم قوي لتغليف وحفظ الطعام",       ["١٠ متر", "٣٠ متر"], MeasurementType.UNIT),
    ...sized("ورق فويل شفاف (استرتش)",    "ورق لاصق شفاف لحفظ الطعام طازجاً",          ["٣٠ متر", "١٠٠ متر"], MeasurementType.UNIT),
    ...sized("أكياس فريزر",               "أكياس بلاستيك محكمة لحفظ الطعام بالفريزر",  ["٢٥ كيس", "٥٠ كيس"], MeasurementType.UNIT),
    ...sized("أكياس ساندوتش",             "أكياس بلاستيك شفافة للسندوتشات",           ["٥٠ كيس"], MeasurementType.UNIT),
    ...sized("أطباق ورقية",               "أطباق ورقية للاستخدام مرة واحدة",           ["١٠ أطباق", "٢٥ طبق"], MeasurementType.UNIT),
    ...sized("أكواب بلاستيك",             "أكواب بلاستيك شفافة للاستخدام مرة واحدة",   ["٢٥ كوب", "٥٠ كوب"], MeasurementType.UNIT),
    ...sized("شوك وملاعق بلاستيك",        "أدوات مائدة بلاستيكية للاستخدام مرة واحدة", ["٢٠ قطعة"], MeasurementType.UNIT),
    ...sized("كيس قمامة متوسط",           "أكياس قمامة سوداء متينة للاستخدام المنزلي", ["٢٠ كيس", "٥٠ كيس"], MeasurementType.UNIT),
    ...sized("كيس قمامة كبير",            "أكياس قمامة سوداء كبيرة الحجم",             ["١٠ أكياس"], MeasurementType.UNIT),
    ...sized("عيدان ثقاب (كبريت)",        "عيدان ثقاب خشبية للاستخدام المنزلي",        ["علبة واحدة"], MeasurementType.UNIT),
  ],

  // ── Household misc: batteries, light bulbs, candles ────────────────────────
  HOUSEHOLD: [
    ...expand([
      { brand: "دوراسيل",   product: "بطاريات قلوية مقاس AA",  sizes: ["عبوة ٤ بطاريات"], measure: MeasurementType.UNIT, desc: "بطاريات قلوية طويلة العمر مقاس AA من دوراسيل" },
      { brand: "دوراسيل",   product: "بطاريات قلوية مقاس AAA", sizes: ["عبوة ٤ بطاريات"], measure: MeasurementType.UNIT, desc: "بطاريات قلوية طويلة العمر مقاس AAA من دوراسيل" },
      { brand: "باناسونيك", product: "بطاريات قلوية مقاس AA",  sizes: ["عبوة ٤ بطاريات"], measure: MeasurementType.UNIT, desc: "بطاريات قلوية اقتصادية مقاس AA من باناسونيك" },
      { brand: "فيليبس",    product: "لمبة ليد إضاءة بيضاء",   sizes: ["٩ وات", "١٢ وات"], measure: MeasurementType.UNIT, desc: "لمبة ليد موفرة للطاقة إضاءة بيضاء من فيليبس" },
      { brand: "فيليبس",    product: "لمبة ليد إضاءة صفراء",   sizes: ["٩ وات"],           measure: MeasurementType.UNIT, desc: "لمبة ليد موفرة للطاقة إضاءة صفراء دافئة من فيليبس" },
    ]),
    ...sized("شموع إضاءة", "شموع بيضاء للإضاءة عند انقطاع الكهرباء", ["عبوة ٦ شموع"], MeasurementType.UNIT),
  ],

  // ── Stationery & school supplies ──────────────────────────────────────────
  STATIONERY: [
    { name: "كشكول سلك A4",           description: "كشكول سلك مُجلَّد A4 بسطر أو مربعات",    measure: MeasurementType.UNIT },
    { name: "كشكول عادي A5",          description: "كشكول عادي مجلد A5 للملاحظات اليومية",   measure: MeasurementType.UNIT },
    { name: "دفتر مذكرات",            description: "مذكرات جيب صغيرة للتدوين السريع",         measure: MeasurementType.UNIT },
    { name: "قلم جاف أزرق",           description: "قلم جاف أزرق ناعم الكتابة متوسط الخط",  measure: MeasurementType.UNIT },
    { name: "قلم جاف أحمر",           description: "قلم جاف أحمر للتصحيح والتأشير",          measure: MeasurementType.UNIT },
    { name: "قلم رصاص HB",           description: "قلم رصاص HB لين الكتابة للرسم والمدرسة", measure: MeasurementType.UNIT },
    { name: "أقلام ملونة خشب 12 لون", description: "طقم أقلام خشب ملونة 12 لون للأطفال",     measure: MeasurementType.UNIT },
    { name: "أقلام فلوماستر 12 لون",  description: "أقلام تلوين فلوماستر للرسم والتزيين",    measure: MeasurementType.UNIT },
    { name: "أقلام تحديد ملونة",      description: "أقلام هايلايتر ملونة لتأشير النصوص",    measure: MeasurementType.UNIT },
    { name: "براية معدنية",           description: "براية قلم معدنية مزدوجة مع درج",         measure: MeasurementType.UNIT },
    { name: "ممحاة بيضاء",           description: "ممحاة بيضاء ناعمة لا تخدش الورق",        measure: MeasurementType.UNIT },
    { name: "مسطرة 30 سم",           description: "مسطرة بلاستيك شفافة 30 سم بالسنتيمترات", measure: MeasurementType.UNIT },
    { name: "ورق A4 رزمة 500 ورقة",   description: "ورق طباعة أبيض A4 80 جرام للطابعات",    measure: MeasurementType.UNIT },
    { name: "ورق ملاحظات لاصق",       description: "بلوك ورق لاصق ملون للتذكير والمذكرات",  measure: MeasurementType.UNIT },
    { name: "مقص مكتبي",              description: "مقص مكتبي متوسط بشفرة حادة",             measure: MeasurementType.UNIT },
    { name: "دباسة مكتبية",           description: "دباسة ورق متوسطة مع علبة دبابيس",        measure: MeasurementType.UNIT },
    { name: "لاصق شريطي شفاف",        description: "لاصق شفاف تيب يصلح للأوراق والعلب",     measure: MeasurementType.UNIT },
    { name: "ملف بلاستيك A4",         description: "ملف L شكل شفاف لحفظ الأوراق A4",        measure: MeasurementType.UNIT },
    { name: "صمغ سائل (لاصق أبيض)",   description: "صمغ سائل أبيض للأعمال اليدوية والمدرسية", measure: MeasurementType.UNIT },
    { name: "آلة حاسبة علمية",         description: "آلة حاسبة للطلاب متعددة الوظائف",         measure: MeasurementType.UNIT },
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
          id: deterministicUUID(`gp:${product.name}:${categoryId}`),
          name: product.name,
          description: product.description,
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
    categoryKeyById: Record<string, string>,
  ): VendorProductSeed[] {
    const vendorProducts: VendorProductSeed[] = [];

    for (const gp of globalProducts) {
      const allowedAssignments = assignmentRules[gp.global_category_id] || [];
      if (allowedAssignments.length === 0) continue;

      // Assign ALL vendors in the group — they're competitors, each should carry core items.
      // This ensures a full demo catalog with no missing products on any vendor.
      for (const assignment of allowedAssignments) {
        const catKey = categoryKeyById[gp.global_category_id] ?? "GROCERY";
        const price = realisticPrice(gp.name, catKey);
        const isWeight = gp.measurement_type === MeasurementType.WEIGHT;

        vendorProducts.push({
          id: deterministicUUID(`vp:${assignment.vendorId}:${gp.id}`),
          vendor_id: assignment.vendorId,
          global_product_id: gp.id,
          vendor_category_id: assignment.vendorCategoryId,
          price,
          stock_quantity: isWeight ? 0 : 120,
          stock_weight_grams: isWeight ? 100_000 : 0,
          is_available: true,
        });
      }
    }

    return vendorProducts;
  }
}
