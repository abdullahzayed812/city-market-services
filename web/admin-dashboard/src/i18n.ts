import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import translationAR from "./locales/ar/translation.json";
import translationEN from "./locales/en/translation.json";

const resources = {
  ar: {
    translation: translationAR,
  },
  en: {
    translation: translationEN,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "ar", // default language
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

// Update document direction on language change
i18n.on("languageChanged", (lng) => {
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lng;
});

// Initial set
document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
document.documentElement.lang = i18n.language;

export default i18n;
