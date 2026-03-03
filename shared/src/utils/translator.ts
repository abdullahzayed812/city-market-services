import en from "../locales/en.json" with { type: "json" };
import ar from "../locales/ar.json" with { type: "json" };

export const dictionaries = { en, ar };

export type SupportedLanguage = "ar" | "en";

export const translate = (
  key: string,
  lang: SupportedLanguage | string = "ar",
  params?: Record<string, any>,
): string => {
  // Normalize language to either 'ar' or 'en', defaulting to 'ar'
  const normalizedLang = lang === "en" ? "en" : "ar";

  // Handle potential ESM default import for JSON or direct object
  const getDict = (l: string) => {
    const d = (dictionaries as any)[l];
    return d?.default || d;
  };

  const dictionary = getDict(normalizedLang) || {};
  const defaultDictionary = getDict("ar") || {};

  // Fallback to Arabic if the key is missing in the chosen language, or just return the key if it's completely missing
  let translation = (dictionary[key] || defaultDictionary[key] || key) as string;

  // Replace variables: e.g., "Only {{count}} left" -> "Only 3 left"
  if (params && typeof params === "object") {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      const regex = new RegExp(`{{\\s*${paramKey}\\s*}}`, "g");
      translation = translation.replace(regex, String(paramValue));
    }
  }

  return translation;
};
