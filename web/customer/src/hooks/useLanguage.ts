import { useTranslation } from 'react-i18next';
import i18n from '../locales/i18n';

export function useLanguage() {
  const { i18n: i18nInstance } = useTranslation();
  const isRTL = i18nInstance.language === 'ar';

  const changeLanguage = (lang: 'ar' | 'en') => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  return { language: i18nInstance.language, isRTL, changeLanguage };
}
