import en from "../locales/en.json" assert { type: "json" };
import ar from "../locales/ar.json" assert { type: "json" };

export const dictionaries = { en, ar };

export type SupportedLanguage = "ar" | "en";

export const translate = (
    key: string,
    lang: SupportedLanguage | string = "ar",
    params?: Record<string, any>
): string => {
    // Normalize language to either 'ar' or 'en', defaulting to 'ar'
    const normalizedLang = lang === "en" ? "en" : "ar";

    const dictionary = dictionaries[normalizedLang] as Record<string, string>;
    const defaultDictionary = dictionaries["ar"] as Record<string, string>;

    // Fallback to Arabic if the key is missing in the chosen language, or just return the key if it's completely missing
    let translation = dictionary[key] || defaultDictionary[key] || key;

    // Replace variables: e.g., "Only {{count}} left" -> "Only 3 left"
    if (params && typeof params === "object") {
        for (const [paramKey, paramValue] of Object.entries(params)) {
            const regex = new RegExp(`{{\\s*${paramKey}\\s*}}`, "g");
            translation = translation.replace(regex, String(paramValue));
        }
    }

    return translation;
};
