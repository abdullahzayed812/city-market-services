// Product-name normalization and similarity, used to warn about likely duplicates in the
// global catalog. It only ranks candidates for a person to look at: nothing is merged
// automatically, and different sizes / variants ("1 kg" vs "5 kg") stay different names.

const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
const EASTERN_ARABIC_INDIC_DIGITS = /[۰-۹]/g;

export function normalizeProductName(name: string): string {
  return tokenizeProductName(name).join(" ");
}

export function tokenizeProductName(name: string): string[] {
  const text = String(name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    // Latin accents
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // "500g" -> "500 g", "كيلو2" -> "كيلو 2"
    .replace(/(\d)([^\d\s.,])/g, "$1 $2")
    .replace(/([^\d\s.,])(\d)/g, "$1 $2")
    .replace(/[^\p{L}\p{N}.]+/gu, " ");

  return text
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
    .map(stripArabicArticle);
}

// "الارز" and "ارز" are the same word for matching purposes
function stripArabicArticle(token: string): string {
  return token.length > 3 && token.startsWith("ال") ? token.slice(2) : token;
}

// Jaccard similarity of the two token sets (0..1)
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(tokenizeProductName(a));
  const tb = new Set(tokenizeProductName(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / (ta.size + tb.size - common);
}

// SQL LIKE patterns that find the raw catalog names containing the most distinctive tokens.
// Letters that normalization unifies become "_" (one character) so "أرز" still matches "ارز".
export function candidateLikePatterns(name: string, max = 3): string[] {
  const tokens = Array.from(new Set(tokenizeProductName(name)))
    .filter((t) => t.length >= 2 && !/^\d+(\.\d+)?$/.test(t))
    .sort((x, y) => y.length - x.length)
    .slice(0, max);
  return tokens.map((t) => `%${t.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[اهيو]/g, "_")}%`);
}
