import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateLikePatterns, nameSimilarity, normalizeProductName } from "../application/utils/product-name";

test("normalizes case, spacing, punctuation and units", () => {
  assert.equal(normalizeProductName("  Organic   QUINOA, 500g! "), "organic quinoa 500 g");
  assert.equal(normalizeProductName("Café Crème"), "cafe creme");
  assert.equal(normalizeProductName("Milk 1.5L"), "milk 1.5 l");
});

test("unifies Arabic letter variants, diacritics, tatweel and digits", () => {
  assert.equal(normalizeProductName("الأرز المصري ١ كيلو"), normalizeProductName("ارز مصري 1 كيلو"));
  assert.equal(normalizeProductName("لَبَن رايب"), normalizeProductName("لبن رايب"));
  assert.equal(normalizeProductName("جبنة"), normalizeProductName("جبنه"));
  assert.equal(normalizeProductName("شاي العروســة"), normalizeProductName("شاى العروسة"));
});

test("different sizes stay different", () => {
  assert.notEqual(normalizeProductName("Rice 1 kg"), normalizeProductName("Rice 5 kg"));
  assert.ok(nameSimilarity("Rice 1 kg", "Rice 5 kg") < 1);
});

test("similarity ranks closer names higher", () => {
  assert.equal(nameSimilarity("Basmati Rice 5kg", "basmati rice 5 KG"), 1);
  assert.ok(nameSimilarity("Basmati Rice 5kg", "Basmati Rice 1kg") > nameSimilarity("Basmati Rice 5kg", "Potato Chips"));
  assert.equal(nameSimilarity("", "x"), 0);
});

test("LIKE patterns tolerate Arabic variants and escape wildcards", () => {
  const patterns = candidateLikePatterns("أرز 100% بسمتي");
  assert.ok(patterns.includes("%بسمت_%"));
  assert.ok(patterns.some((p) => p === "%_رز%"));
  assert.ok(patterns.every((p) => !p.includes("100")), "numbers alone aren't distinctive");
  assert.deepEqual(candidateLikePatterns("50_off"), ["%off%"]);
});
