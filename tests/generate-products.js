import fs from "fs";

const data = [
  // 🥛 ألبان
  { category: "الألبان", name: "حليب", brands: ["جهينة", "المراعي", "دومتي"], units: ["1 لتر", "500 مل"] },
  { category: "الألبان", name: "زبادي", brands: ["جهينة", "المراعي"], units: ["170 جم", "500 جم"] },
  { category: "الألبان", name: "جبنة بيضاء", brands: ["دومتي", "عبور لاند"], units: ["250 جم", "500 جم", "1 كجم"] },

  // 🥤 مشروبات
  { category: "المشروبات", name: "بيبسي", brands: ["بيبسي"], units: ["330 مل", "1 لتر", "2 لتر"] },
  { category: "المشروبات", name: "كوكاكولا", brands: ["كوكاكولا"], units: ["330 مل", "1 لتر", "2 لتر"] },
  { category: "المشروبات", name: "مياه معدنية", brands: ["بيروس", "أكوا فينا"], units: ["600 مل", "1.5 لتر"] },

  // 🍚 بقالة
  { category: "البقالة", name: "أرز", brands: ["الضحى"], units: ["1 كجم", "5 كجم"] },
  { category: "البقالة", name: "مكرونة", brands: ["ريجينا"], units: ["350 جم", "1 كجم"] },

  // 🧼 منظفات
  { category: "المنظفات", name: "مسحوق غسيل", brands: ["تايد"], units: ["2 كجم", "4 كجم"] },
  { category: "المنظفات", name: "سائل أطباق", brands: ["فيري"], units: ["500 مل", "1 لتر"] },

  // 🍞 مخبوزات
  { category: "المخبوزات", name: "توست", brands: ["ريتش بيك"], units: ["1 عبوة"] },

  // 🍅 خضار وفاكهة (بدون براند)
  { category: "خضروات وفاكهة", name: "طماطم", brands: [""], units: ["1 كجم"] },
  { category: "خضروات وفاكهة", name: "بطاطس", brands: [""], units: ["1 كجم"] },
];

const extras = ["طازج", "فاخر", "جودة عالية", "عرض"];

const rows = ["name,description,category"];
let count = 0;

for (let i = 0; i < 100; i++) {
  for (const item of data) {
    for (const brand of item.brands) {
      for (const unit of item.units) {
        const extra = extras[i % extras.length];

        const name = `${item.name} ${brand} ${unit} ${extra}`.replace(/\s+/g, " ").trim();
        const description = `${item.name} ${brand} بحجم ${unit}`.trim();

        rows.push(`${name},${description},${item.category}`);

        count++;
        if (count >= 3000) break;
      }
      if (count >= 3000) break;
    }
    if (count >= 3000) break;
  }
  if (count >= 3000) break;
}

fs.writeFileSync("products.csv", rows.join("\n"));

console.log("✅ Clean Egyptian CSV generated");
