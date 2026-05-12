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
//  Realistic EGP price ranges (2024-2025, Alexandria / Borg El Arab market).
//  Weight products: price is per KG.
//  Unit products:  price is per sellable unit/pack.
// ─────────────────────────────────────────────────────────────────────────────
const PRICE_RANGES: Record<string, [number, number]> = {
  // Dairy — per unit (milk carton, yogurt, cheese pack) or per kg (white cheeses)
  DAIRY:        [12,  110],
  // Eggs — price per tray (30 eggs) or per dozen
  EGGS:         [75,  140],
  // Beverages — per bottle/can/pack
  DRINKS:       [5,   55],
  // Dry grocery — weight items per kg, unit items per pack
  GROCERY:      [18,  145],
  // Spices — per 100g (stored as price/kg in system → multiply by 10 on display)
  SPICES:       [30,  320],
  // Cleaning supplies — per unit/bottle
  CLEANING:     [15,  130],
  // Personal care — per unit
  PERSONAL_CARE:[25,  280],
  // Baby products — per pack
  BABY:         [35,  420],
  // Fresh beef & lamb — per kg
  MEAT:         [220, 480],
  // Fresh poultry — per kg
  POULTRY:      [80,  220],
  // Fresh fish & seafood — per kg
  FISH:         [55,  420],
  // Bakery — per loaf/pack (bread is cheap)
  BAKERY:       [3,   65],
  // Oriental sweets — per kg
  PASTRY:       [120, 480],
  // Packaged snacks — per bag/box
  SNACKS:       [8,   90],
  // Roastery — per kg (nuts are expensive)
  ROASTERY:     [55,  750],
  // Fresh produce — per kg (seasonal variability)
  VEG_FRUIT:    [8,   120],
  // Frozen foods — per pack
  FROZEN:       [55,  195],
  // Stationery — per item
  STATIONERY:   [5,   185],
};

// Per-product price overrides for items whose range would be misleading.
// Key = exact Arabic product name.
const PRICE_OVERRIDES: Record<string, [number, number]> = {
  // Dairy
  "حليب طازج كامل الدسم":       [35,  50],
  "حليب معقم طويل الأمد":        [25,  42],
  "حليب مكثف محلى":              [22,  38],
  "زبادي طبيعي":                 [12,  22],
  "زبادي بالفواكه":               [14,  25],
  "لبن رايب":                    [18,  32],
  "لبن مخفف":                    [10,  20],
  "قشطة طازجة":                  [20,  38],
  "قشطة معلبة":                  [18,  32],
  "كريمة الطهي":                 [28,  55],
  "زبدة بلدية":                  [55,  95],
  "جبنة قريش":                   [28,  50],  // per 250g unit
  "جبنة بيضاء مملحة":            [55,  95],  // per 500g
  "جبنة رومي":                   [190, 340], // per kg
  "جبنة فلمنك":                  [170, 290],
  "جبنة بيضاء مطبوخة":           [60,  110], // per 500g foil
  "جبنة موتزاريلا":              [120, 220], // per 200g
  "جبنة كريم":                   [45,  85],
  "جبنة مثلثات":                 [35,  65],
  // Eggs
  "بيض بلدي":                    [90,  135], // tray 30 eggs
  "بيض أبيض":                    [75,  115],
  "بيض بط":                      [95,  145],
  "بيض سمان":                    [40,  70],
  // Drinks
  "مياه معدنية":                  [5,   15],
  "مياه غازية":                   [10,  22],
  "مشروب كولا":                   [15,  28],
  "مشروب مالت بالفاكهة":          [18,  32],
  "مشروب طاقة":                   [28,  55],
  "عصير برتقال طبيعي":            [22,  45],
  "عصير مانجو":                   [18,  38],
  "شاي أكياس":                    [25,  65],
  "نسكافيه سريع التحضير":         [45,  95],
  "كركديه جاف":                   [30,  65],
  // Meat per kg
  "لحم بقري موزة":                [280, 400],
  "لحم بقري مفروم":               [260, 380],
  "لحم بقري فيليه":               [380, 480],
  "كبدة بقري":                   [180, 260],
  "لحم ضاني مشكل":               [310, 450],
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
  "جمبري كبير":                   [260, 420],
  "جمبري وسط":                   [160, 280],
  "فسيخ":                        [180, 350],
  "رنجة مدخنة":                   [120, 220],
  "كابوريا طازجة":                [250, 420],
  "بياض بوري (بطارخ)":           [280, 500],
  // Bakery
  "عيش بلدي":                    [3,   8],
  "عيش فينو":                    [5,   12],
  "توست أبيض":                   [30,  50],
  "توست أسمر":                   [32,  52],
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
  // Grocery — weight items per kg
  "أرز مصري":                    [35,  58],
  "أرز بسمتي":                   [55,  90],
  "سكر أبيض":                    [35,  48],
  "دقيق أبيض":                   [25,  42],
  "عدس أصفر":                    [38,  62],
  "فول مجفف":                    [42,  75],
  // Spices per 100g (system stores price as per-kg, UI shows /100g)
  "كمون مطحون":                   [30,  60],
  "فلفل أسود مطحون":              [45,  90],
  "كركم":                        [40,  80],
  "حبة البركة":                  [55,  120],
  "زعفران":                       [250, 320], // expensive
};

function realisticPrice(productName: string, categoryKey: string): number {
  const override = PRICE_OVERRIDES[productName];
  const range = override ?? PRICE_RANGES[categoryKey] ?? [20, 150];
  const [min, max] = range;
  // Random within range, rounded to nearest 0.5 EGP
  const raw = min + Math.random() * (max - min);
  return Math.round(raw * 2) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Global product catalog — Egyptian market (Borg El Arab / Alexandria).
//  Rules:
//    • No brand names.
//    • Weight products → 100 kg initial stock (100_000 g).
//    • Unit products  → 120 units initial stock.
//    • Descriptions are informative 4–10 word phrases.
// ─────────────────────────────────────────────────────────────────────────────
interface ProductDef {
  name: string;
  description: string;
  measure: MeasurementType;
}

const GLOBAL_PRODUCTS: Record<string, ProductDef[]> = {

  // ── Dairy & dairy alternatives ─────────────────────────────────────────────
  DAIRY: [
    { name: "حليب طازج كامل الدسم",    description: "حليب بقري طازج كامل الدسم معبأ",           measure: MeasurementType.UNIT },
    { name: "حليب نصف دسم",            description: "حليب بقري منخفض الدسم",                    measure: MeasurementType.UNIT },
    { name: "حليب خالي الدسم",         description: "حليب بقري خالي الدسم كلياً",               measure: MeasurementType.UNIT },
    { name: "حليب معقم طويل الأمد",    description: "حليب معقم يصلح للتخزين",                   measure: MeasurementType.UNIT },
    { name: "حليب مكثف محلى",          description: "حليب مكثف محلى بالسكر للحلويات",           measure: MeasurementType.UNIT },
    { name: "زبادي طبيعي",             description: "زبادي طبيعي طازج من حليب بقري كامل",       measure: MeasurementType.UNIT },
    { name: "زبادي بالفواكه",          description: "زبادي كريمي بنكهات الفواكه الطازجة",       measure: MeasurementType.UNIT },
    { name: "لبن رايب",                description: "لبن رايب بلدي طازج كريمي",                 measure: MeasurementType.UNIT },
    { name: "لبن مخفف",                description: "لبن بقري مخفف خفيف ومنعش",                measure: MeasurementType.UNIT },
    { name: "قشطة طازجة",              description: "قشطة طازجة كاملة الدسم للتقديم",           measure: MeasurementType.UNIT },
    { name: "قشطة معلبة",              description: "قشطة محلاة معلبة للحلويات",                measure: MeasurementType.UNIT },
    { name: "كريمة الطهي",             description: "كريمة سائلة خفيفة للطهي والصلصات",        measure: MeasurementType.UNIT },
    { name: "زبدة بلدية",              description: "زبدة بقري بلدية مملحة طازجة",              measure: MeasurementType.UNIT },
    { name: "جبنة قريش",               description: "جبنة قريش طازجة بيضاء قليلة الدسم",       measure: MeasurementType.WEIGHT },
    { name: "جبنة بيضاء مملحة",        description: "جبنة بيضاء مملحة في المحلول",              measure: MeasurementType.WEIGHT },
    { name: "جبنة رومي",               description: "جبنة رومي صلبة ذات طعم حاد",              measure: MeasurementType.WEIGHT },
    { name: "جبنة فلمنك",              description: "جبنة فلمنك شبه صلبة خفيفة الطعم",         measure: MeasurementType.WEIGHT },
    { name: "جبنة بيضاء مطبوخة",       description: "جبنة بيضاء مطبوخة ناعمة في ورق الألمونيوم", measure: MeasurementType.UNIT },
    { name: "جبنة موتزاريلا",          description: "جبنة موتزاريلا طازجة للبيتزا والسلطات",   measure: MeasurementType.WEIGHT },
    { name: "جبنة كريم",               description: "جبنة كريمية ناعمة للفطار والحلويات",       measure: MeasurementType.UNIT },
    { name: "جبنة مثلثات",             description: "جبنة مثلثات مصهورة سهلة الدهن",           measure: MeasurementType.UNIT },
  ],

  // ── Eggs ───────────────────────────────────────────────────────────────────
  EGGS: [
    { name: "بيض بلدي",               description: "بيض دجاج بلدي طازج من مزارع محلية",       measure: MeasurementType.UNIT },
    { name: "بيض أبيض",               description: "بيض دجاج أبيض طازج حجم كبير",             measure: MeasurementType.UNIT },
    { name: "بيض بط",                 description: "بيض بط طازج ذو صفار كبير ودسم",            measure: MeasurementType.UNIT },
    { name: "بيض سمان",               description: "بيض سمان طازج صغير الحجم غني بالبروتين", measure: MeasurementType.UNIT },
  ],

  // ── Beverages ──────────────────────────────────────────────────────────────
  DRINKS: [
    { name: "مياه معدنية",             description: "مياه معدنية نقية محلية",                   measure: MeasurementType.UNIT },
    { name: "مياه غازية",              description: "مياه معدنية فوارة منعشة",                  measure: MeasurementType.UNIT },
    { name: "عصير برتقال طبيعي",       description: "عصير برتقال مضغوط 100% طبيعي",            measure: MeasurementType.UNIT },
    { name: "عصير مانجو",              description: "عصير مانجو طبيعي مركز بدون إضافات",       measure: MeasurementType.UNIT },
    { name: "عصير تفاح",               description: "عصير تفاح صافٍ بدون سكر مضاف",            measure: MeasurementType.UNIT },
    { name: "عصير جوافة",              description: "عصير جوافة طبيعي كثيف القوام",             measure: MeasurementType.UNIT },
    { name: "عصير فراولة",             description: "عصير فراولة طبيعي حلو ومنعش",             measure: MeasurementType.UNIT },
    { name: "مشروب كولا",              description: "مشروب غازي بنكهة الكولا المنعشة",          measure: MeasurementType.UNIT },
    { name: "مشروب ليمون غازي",        description: "مشروب غازي بنكهة الليمون الحامض",          measure: MeasurementType.UNIT },
    { name: "مشروب برتقال غازي",       description: "مشروب غازي بنكهة البرتقال المنعشة",        measure: MeasurementType.UNIT },
    { name: "مشروب مالت بالفاكهة",     description: "مشروب شعير غازي بنكهة الفاكهة",           measure: MeasurementType.UNIT },
    { name: "مشروب طاقة",              description: "مشروب طاقة يزيد التركيز والنشاط",          measure: MeasurementType.UNIT },
    { name: "شاي أكياس",               description: "شاي أسود فاخر في أكياس مفردة",             measure: MeasurementType.UNIT },
    { name: "شاي كرك جاهز",           description: "شاي كرك بالحليب والبهارات جاهز للشرب",    measure: MeasurementType.UNIT },
    { name: "نسكافيه سريع التحضير",    description: "قهوة فورية كلاسيكية سريعة التحضير",        measure: MeasurementType.UNIT },
    { name: "نسكافيه 3 في 1",          description: "قهوة فورية بالحليب والسكر في كيس واحد",    measure: MeasurementType.UNIT },
    { name: "مشروب سحلب",              description: "مشروب سحلب دافئ بالجوز والقرفة",           measure: MeasurementType.UNIT },
    { name: "كركديه جاف",              description: "كركديه مجفف للشرب البارد والساخن",         measure: MeasurementType.UNIT },
    { name: "تانج مسحوق برتقال",       description: "مسحوق برتقال سريع التحضير للعصير",        measure: MeasurementType.UNIT },
  ],

  // ── Dry grocery, oils, canned goods ───────────────────────────────────────
  GROCERY: [
    { name: "أرز مصري",                description: "أرز مصري أبيض قصير الحبة",                 measure: MeasurementType.WEIGHT },
    { name: "أرز بسمتي",               description: "أرز بسمتي طويل الحبة ذو رائحة عطرة",      measure: MeasurementType.WEIGHT },
    { name: "سكر أبيض",                description: "سكر أبيض ناعم مكرر للاستخدام اليومي",    measure: MeasurementType.WEIGHT },
    { name: "دقيق أبيض",               description: "دقيق قمح أبيض متعدد الاستخدامات",         measure: MeasurementType.WEIGHT },
    { name: "سميد خشن",                description: "سميد قمح خشن للحلويات والكيك",             measure: MeasurementType.WEIGHT },
    { name: "فريك",                    description: "قمح أخضر مدخن ذو نكهة مميزة",             measure: MeasurementType.WEIGHT },
    { name: "شعرية",                   description: "شعرية قمح رفيعة للشوربة والأرز",           measure: MeasurementType.WEIGHT },
    { name: "برغل خشن",                description: "برغل قمح خشن للتبولة والطبخ",              measure: MeasurementType.WEIGHT },
    { name: "عدس أصفر",                description: "عدس أصفر مقشور سريع الطهي",               measure: MeasurementType.WEIGHT },
    { name: "عدس أحمر",                description: "عدس أحمر مجروش للشوربة والأطباق",          measure: MeasurementType.WEIGHT },
    { name: "فول مجفف",                description: "فول بلدي مجفف للفول المدمس والأطباق",      measure: MeasurementType.WEIGHT },
    { name: "حمص مجفف",                description: "حمص مجفف للطهي والحمص الشامي",             measure: MeasurementType.WEIGHT },
    { name: "لوبيا",                   description: "لوبيا جافة بيضاء أو حمراء للطهي",          measure: MeasurementType.WEIGHT },
    { name: "مكرونة سباغيتي",          description: "مكرونة سباغيتي قمح صلب",                   measure: MeasurementType.UNIT },
    { name: "مكرونة قلم",              description: "مكرونة قلم كبير أو صغير للبشاميل",         measure: MeasurementType.UNIT },
    { name: "مكرونة فرخة",             description: "مكرونة فرخة عريضة للبسطة",                 measure: MeasurementType.UNIT },
    { name: "مكرونة ريشة",             description: "مكرونة ريشة صلبة للصلصات",                 measure: MeasurementType.UNIT },
    { name: "زيت ذرة",                 description: "زيت ذرة نقي للقلي والطهي",                 measure: MeasurementType.UNIT },
    { name: "زيت عباد الشمس",          description: "زيت عباد شمس خفيف للسلطات والقلي",        measure: MeasurementType.UNIT },
    { name: "زيت زيتون بكر ممتاز",    description: "زيت زيتون بكر ممتاز ضغط بارد",             measure: MeasurementType.UNIT },
    { name: "سمن نباتي",               description: "سمن نباتي صلب للخبز والطهي",               measure: MeasurementType.UNIT },
    { name: "سمن بلدي",                description: "سمن حيواني بلدي أصيل النكهة",              measure: MeasurementType.UNIT },
    { name: "معجون طماطم",             description: "معجون طماطم مركز للطبخ والصلصات",          measure: MeasurementType.UNIT },
    { name: "صلصة طماطم معلبة",        description: "صلصة طماطم مطبوخة جاهزة للاستخدام",       measure: MeasurementType.UNIT },
    { name: "طحينية",                  description: "طحينية سمسم نقية ناعمة القوام",            measure: MeasurementType.UNIT },
    { name: "كاتشب طماطم",             description: "كاتشب طماطم حلو وحامض جاهز",              measure: MeasurementType.UNIT },
    { name: "مايونيز",                 description: "مايونيز كريمي دسم للسندوتشات والسلطات",   measure: MeasurementType.UNIT },
    { name: "صلصة حارة",               description: "صلصة فلفل حار للطبخ والتقديم",             measure: MeasurementType.UNIT },
    { name: "صلصة صويا",               description: "صلصة صويا مالحة للتتبيل والطبخ الآسيوي", measure: MeasurementType.UNIT },
    { name: "تونة في الزيت",           description: "تونة مطبوخة معلبة في زيت عباد الشمس",     measure: MeasurementType.UNIT },
    { name: "فول معلب",                description: "فول مطبوخ معلب جاهز للتقديم",              measure: MeasurementType.UNIT },
    { name: "بازلاء معلبة",           description: "بازلاء خضراء معلبة ناعمة",                  measure: MeasurementType.UNIT },
    { name: "ذرة معلبة",               description: "حبوب ذرة صفراء حلوة معلبة",               measure: MeasurementType.UNIT },
    { name: "مربى فراولة",             description: "مربى فراولة حلو طبيعي للفطار",             measure: MeasurementType.UNIT },
    { name: "مربى برتقال",             description: "مربى برتقال بقشر الترنج العطري",           measure: MeasurementType.UNIT },
    { name: "عسل نحل طبيعي",           description: "عسل نحل طبيعي 100% بدون إضافات",          measure: MeasurementType.UNIT },
    { name: "ملح طعام",                description: "ملح طعام أبيض ناعم مضاف إليه يود",         measure: MeasurementType.UNIT },
    { name: "خل بلدي",                 description: "خل أبيض طبيعي للطبخ والتخليل",             measure: MeasurementType.UNIT },
    { name: "نشا ذرة",                 description: "نشا ذرة أبيض ناعم للصلصات والحلويات",     measure: MeasurementType.UNIT },
    { name: "بيكنج باودر",             description: "مسحوق الخبيز لتخمير العجائن والكيك",       measure: MeasurementType.UNIT },
    { name: "كاكاو",                   description: "مسحوق كاكاو داكن للحلويات والمخبوزات",    measure: MeasurementType.UNIT },
    { name: "خميرة فورية",             measure: MeasurementType.UNIT, description: "خميرة جافة فورية لتخمير العجين والخبز" },
    { name: "بقسماط مطحون",           description: "فتت بقسماط مطحون للتحميص والبانيه",        measure: MeasurementType.UNIT },
  ],

  // ── Spices & dried herbs ───────────────────────────────────────────────────
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
    { name: "مسحوق كاري",              description: "خلطة كاري هندية معتدلة الحرارة",            measure: MeasurementType.WEIGHT },
    { name: "زعفران",                  description: "زعفران حقيقي ذو رائحة ولون مميزَين",        measure: MeasurementType.WEIGHT },
  ],

  // ── Household cleaning ─────────────────────────────────────────────────────
  CLEANING: [
    { name: "مسحوق غسيل",              description: "مسحوق غسيل قوي للملابس اليدوي والآلي",     measure: MeasurementType.UNIT },
    { name: "سائل غسيل ملابس",         description: "سائل غسيل سائل للأقمشة الحساسة",           measure: MeasurementType.UNIT },
    { name: "منعم ملابس",              description: "منعم ملابس بعطر الربيع للغسيل",             measure: MeasurementType.UNIT },
    { name: "صابون سائل للأطباق",      description: "جلي سائل مركز لتنظيف الأطباق والمطبخ",    measure: MeasurementType.UNIT },
    { name: "منظف أرضيات",             description: "منظف مطهر للأرضيات بعطر الليمون",          measure: MeasurementType.UNIT },
    { name: "منظف حمامات",             description: "منظف حمامات مضاد للترسبات والبكتيريا",    measure: MeasurementType.UNIT },
    { name: "كلور مطهر",               description: "محلول كلور مركز للتطهير والتبييض",         measure: MeasurementType.UNIT },
    { name: "مناديل تواليت",           description: "مناديل تواليت بيضاء ناعمة متعددة الطبقات", measure: MeasurementType.UNIT },
    { name: "مناديل ورقية",            description: "مناديل ورقية ناعمة للوجه والمائدة",        measure: MeasurementType.UNIT },
    { name: "فوط مطبخ ورقية",          description: "فوط ورقية قوية لتنظيف المطبخ",              measure: MeasurementType.UNIT },
    { name: "معطر جو",                 description: "معطر هواء برائحة الورد أو الياسمين",        measure: MeasurementType.UNIT },
    { name: "مبيد حشرات",              description: "بخاخ مبيد حشرات للمنازل سريع المفعول",     measure: MeasurementType.UNIT },
    { name: "كيس قمامة",               description: "أكياس قمامة سوداء متينة بحجامات مختلفة",  measure: MeasurementType.UNIT },
    { name: "إسفنجة جلي",             description: "إسفنجة تنظيف مزدوجة الوجه للمطبخ",        measure: MeasurementType.UNIT },
    { name: "ليفة تنظيف معدنية",       description: "ليفة مجدولة معدنية للأواني الصعبة",        measure: MeasurementType.UNIT },
    { name: "غسول الصحون الجافة",      description: "مسحوق جلي الصحون للغسالة الآلية",         measure: MeasurementType.UNIT },
  ],

  // ── Personal care & OTC pharmacy ──────────────────────────────────────────
  PERSONAL_CARE: [
    { name: "شامبو للشعر العادي",       description: "شامبو يومي للشعر العادي يُنظف ويُلمع",     measure: MeasurementType.UNIT },
    { name: "شامبو للشعر الجاف",        description: "شامبو مرطب وترميمي للشعر الجاف",           measure: MeasurementType.UNIT },
    { name: "بلسم شعر",                description: "بلسم مرطب لتسهيل تمشيط الشعر",             measure: MeasurementType.UNIT },
    { name: "صابون استحمام",            description: "صابون صلب لتنظيف الجسم بعطر منعش",        measure: MeasurementType.UNIT },
    { name: "جل استحمام",               description: "جل استحمام سائل كريمي بعطر الخزامى",      measure: MeasurementType.UNIT },
    { name: "معجون أسنان",              description: "معجون أسنان بالفلورايد لتبييض الأسنان",   measure: MeasurementType.UNIT },
    { name: "فرشاة أسنان",              description: "فرشاة أسنان بشعيرات ناعمة ومتوسطة",       measure: MeasurementType.UNIT },
    { name: "مزيل عرق رول",            description: "مزيل عرق رول 48 ساعة بلا كحول",            measure: MeasurementType.UNIT },
    { name: "مزيل عرق بخاخ",           description: "مزيل عرق سبراي 48 ساعة بعطر منعش",        measure: MeasurementType.UNIT },
    { name: "كريم ترطيب للبشرة",        description: "كريم مرطب للبشرة الجافة يومي وليلي",      measure: MeasurementType.UNIT },
    { name: "كريم يدين",               description: "كريم مرطب للأيدي بزيت الشيا",             measure: MeasurementType.UNIT },
    { name: "واقي شمس",                description: "كريم واقي شمس SPF50 للوجه والجسم",         measure: MeasurementType.UNIT },
    { name: "غسول وجه",                description: "غسول وجه مُزيل للمكياج والشوائب",          measure: MeasurementType.UNIT },
    { name: "شفرة حلاقة",              description: "شفرة حلاقة رجالي متعددة الشفرات",          measure: MeasurementType.UNIT },
    { name: "كريم حلاقة",              description: "كريم حلاقة مرطب يُليّن الشعر",             measure: MeasurementType.UNIT },
    { name: "قطن طبي",                  description: "قطن طبي أبيض نقي للجروح والعناية",        measure: MeasurementType.UNIT },
    { name: "ضمادات طبية",              description: "ضمادات جروح لاصقة مُعقمة مقاسات مختلفة", measure: MeasurementType.UNIT },
    { name: "محلول مطهر",              description: "محلول مطهر ومضاد للبكتيريا للجروح",        measure: MeasurementType.UNIT },
    { name: "مسكن ألم أقراص",          description: "أقراص مسكنة وخافضة للحرارة للبالغين",     measure: MeasurementType.UNIT },
    { name: "فيتامين سي أقراص",        description: "أقراص فيتامين C 500mg لتعزيز المناعة",    measure: MeasurementType.UNIT },
    { name: "مناديل مبللة للكبار",      description: "مناديل مبللة مُطهرة للاستخدام الشخصي",   measure: MeasurementType.UNIT },
  ],

  // ── Baby products ──────────────────────────────────────────────────────────
  BABY: [
    { name: "حفاضات أطفال",            description: "حفاضات فائقة الامتصاص بمقاسات مختلفة",    measure: MeasurementType.UNIT },
    { name: "مناشف رطبة للأطفال",      description: "مناشف رطبة معطرة لتنظيف بشرة الرضع",     measure: MeasurementType.UNIT },
    { name: "حليب أطفال مجفف",         description: "حليب مجفف اصطناعي لتغذية الرضع",          measure: MeasurementType.UNIT },
    { name: "شامبو أطفال",             description: "شامبو أطفال بدون دموع لطيف على العين",    measure: MeasurementType.UNIT },
    { name: "كريم حفاضات",             description: "كريم واقٍ من التهيج وطفح الحفاضات",       measure: MeasurementType.UNIT },
    { name: "بودرة أطفال",             description: "بودرة زلق ناعمة للبشرة لحماية الطية",     measure: MeasurementType.UNIT },
    { name: "زيت أطفال",               description: "زيت رضع خفيف للتدليك واليدين",            measure: MeasurementType.UNIT },
    { name: "غذاء أطفال بالحبوب",      description: "حبوب دقيق أطفال سريعة التحضير بالفاكهة", measure: MeasurementType.UNIT },
    { name: "غذاء أطفال معلب",         description: "أغذية أطفال معلبة بالخضروات والفاكهة",   measure: MeasurementType.UNIT },
  ],

  // ── Packaged snacks ────────────────────────────────────────────────────────
  SNACKS: [
    { name: "شيبس بطاطس",              description: "شيبس بطاطس محمصة مقرمشة بعدة نكهات",      measure: MeasurementType.UNIT },
    { name: "شيبس جبنة",               description: "شيبس ذرة بنكهة الجبنة البارزة",            measure: MeasurementType.UNIT },
    { name: "شيبس عدس",                description: "شيبس عدس خفيف ومقرمش غني بالبروتين",     measure: MeasurementType.UNIT },
    { name: "بسكويت سادة",             description: "بسكويت زبدة سادة مقرمش للفطار",           measure: MeasurementType.UNIT },
    { name: "بسكويت شوكولاتة",         description: "بسكويت محشو بكريمة الشوكولاتة",           measure: MeasurementType.UNIT },
    { name: "بسكويت مالح بالجبنة",     description: "بسكويت مالح مقرمش بنكهة الجبنة",          measure: MeasurementType.UNIT },
    { name: "ويفر شوكولاتة",           description: "ويفر مقرمش طبقات بكريمة الكاكاو",         measure: MeasurementType.UNIT },
    { name: "كيك شوكولاتة",            description: "كيك إسفنجي بالشوكولاتة فردي المعلب",      measure: MeasurementType.UNIT },
    { name: "شوكولاتة ألواح",          description: "لوح شوكولاتة حليب أو داكنة",               measure: MeasurementType.UNIT },
    { name: "رقائق ذرة (كورن فليكس)",  description: "رقائق ذرة مقرمشة للفطار بالحليب",         measure: MeasurementType.UNIT },
    { name: "فشار مورق",               description: "فشار مورق خفيف محمص بزبدة الفشار",         measure: MeasurementType.UNIT },
    { name: "جيلي ملون",               description: "حلوى جيلي ناعمة ملونة بنكهات الفاكهة",    measure: MeasurementType.UNIT },
    { name: "حلوى صابلية",             description: "حلوى صابلية هشة بالزبدة والسكر",           measure: MeasurementType.UNIT },
    { name: "حلاوة طحينية",           description: "حلاوة طحينية قطعة بالسمسم والفانيليا",     measure: MeasurementType.WEIGHT },
  ],

  // ── Roastery — nuts, seeds, dried fruits, ground coffee ────────────────────
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

  // ── Fresh beef & lamb ──────────────────────────────────────────────────────
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
    { name: "ضلوع ضاني",              description: "ضلوع خروف طازجة للشواء والفرن",            measure: MeasurementType.WEIGHT },
    { name: "كبدة ضاني",              description: "كبدة خروف طازجة ذات طعم لطيف",            measure: MeasurementType.WEIGHT },
    { name: "سجق بلدي",               description: "سجق بقري بلدي مرتب بالتوابل",             measure: MeasurementType.WEIGHT },
    { name: "كفتة طازجة",             description: "كفتة لحم بلدي مرتبة جاهزة للشوي",         measure: MeasurementType.WEIGHT },
  ],

  // ── Fresh poultry ──────────────────────────────────────────────────────────
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

  // ── Fresh produce — vegetables & fruit ────────────────────────────────────
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
  ],

  // ── Fresh bread & bakery ───────────────────────────────────────────────────
  BAKERY: [
    { name: "عيش بلدي",                description: "رغيف بلدي طازج من الطحين الكامل",           measure: MeasurementType.UNIT },
    { name: "عيش فينو",                description: "خبز فينو طازج ناعم طويل",                   measure: MeasurementType.UNIT },
    { name: "عيش شمس",                 description: "خبز شمس منبوش طازج بالسمسم",               measure: MeasurementType.UNIT },
    { name: "توست أبيض",               description: "رغيف توست أبيض متعدد الشرائح",              measure: MeasurementType.UNIT },
    { name: "توست أسمر",               description: "رغيف توست أسمر قمح كامل",                   measure: MeasurementType.UNIT },
    { name: "توست القمح الكامل",        description: "توست بالحبوب الكاملة صحي ومقوٍّ",           measure: MeasurementType.UNIT },
    { name: "كعك بالسمسم",             description: "كعك مصري بالسمسم والعسل إسكندراني",        measure: MeasurementType.UNIT },
    { name: "خبز صاج",                 description: "خبز صاج رفيع طازج للسندوتشات",             measure: MeasurementType.UNIT },
    { name: "فطير مشلتت",              description: "فطير مشلتت ورقي بالسمن البلدي",             measure: MeasurementType.UNIT },
    { name: "فطير سادة",               description: "فطير سادة محمر بالفرن أو التنور",           measure: MeasurementType.UNIT },
    { name: "كعك سادة",                description: "كعك دائري سادة خفيف وهشّ",                 measure: MeasurementType.UNIT },
    { name: "فطاير سبانخ",             description: "فطائر محشوة بالسبانخ والبصل والتوابل",     measure: MeasurementType.UNIT },
  ],

  // ── Oriental sweets & pastry ──────────────────────────────────────────────
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
    { name: "مهلبية",                  description: "مهلبية بالحليب والسكر والعرق سوس",          measure: MeasurementType.UNIT },
    { name: "أرز بلبن",                description: "أرز بلبن كريمي بالقرفة والمكسرات",         measure: MeasurementType.UNIT },
    { name: "أم علي",                  description: "أم علي دافئة بالمكسرات والقشطة والسكر",    measure: MeasurementType.UNIT },
  ],

  // ── Fresh fish & seafood (Alexandria / Mediterranean market) ──────────────
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
    { name: "جمبري وسط",               description: "جمبري وسط طازج للقلي والشوي",              measure: MeasurementType.WEIGHT },
    { name: "جمبري كبير",              description: "جمبري تايجر كبير طازج للمناسبات",           measure: MeasurementType.WEIGHT },
    { name: "كابوريا طازجة",           description: "كابوريا بحر متوسطي طازجة كاملة",           measure: MeasurementType.WEIGHT },
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
    { name: "بطاطس مجمدة",             description: "بطاطس مجمدة مقطعة للقلي أو الفرن",        measure: MeasurementType.UNIT },
    { name: "خضروات مجمدة مشكلة",      description: "خلطة خضروات مجمدة جزر وذرة وبازلاء",     measure: MeasurementType.UNIT },
    { name: "بازلاء مجمدة",            description: "بازلاء خضراء مجمدة كاملة الحبة",          measure: MeasurementType.UNIT },
    { name: "ذرة مجمدة",               description: "حبوب ذرة صفراء مجمدة حلوة",               measure: MeasurementType.UNIT },
    { name: "صدور دجاج مجمدة",         description: "صدور دجاج مجمدة بلا جلد وبلا عظم",       measure: MeasurementType.UNIT },
    { name: "دجاج مجمد كامل",          description: "دجاجة كاملة مجمدة مذبوحة ومنظفة",        measure: MeasurementType.UNIT },
    { name: "جمبري مجمد",              description: "جمبري مجمد مقشور أو كامل القشرة",         measure: MeasurementType.UNIT },
    { name: "سمك فيليه مجمد",          description: "فيليه سمك أبيض مجمد بلا عظم",             measure: MeasurementType.UNIT },
    { name: "كفتة مجمدة",              description: "أصابع كفتة لحم مجمدة جاهزة للشواء",      measure: MeasurementType.UNIT },
    { name: "برجر دجاج مجمد",          description: "قرص برجر دجاج مجمد جاهز للقلي",          measure: MeasurementType.UNIT },
    { name: "سمبوسك مجمد",             description: "سمبوسك محشو مجمد بالجبنة أو اللحم",      measure: MeasurementType.UNIT },
    { name: "محشي كرنب مجمد",          description: "لفائف كرنب محشي مجمدة جاهزة للطهي",     measure: MeasurementType.UNIT },
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
