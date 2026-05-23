import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar/translation.json';
import en from './en/translation.json';

const savedLang = localStorage.getItem('lang') || 'ar';

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: savedLang,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

// Apply direction on init
document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = savedLang;

export default i18n;
