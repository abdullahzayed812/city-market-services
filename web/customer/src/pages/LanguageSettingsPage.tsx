import { Globe, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const LANGS = [
  { code: 'ar', label: 'العربية', nativeLabel: 'Arabic', flag: '🇸🇦' },
  { code: 'en', label: 'English', nativeLabel: 'الإنجليزية', flag: '🇺🇸' },
];

export default function LanguageSettingsPage() {
  const { t } = useTranslation();
  const { language, changeLanguage, isRTL } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            {isRTL ? (
              <ChevronRight size={20} className="text-text-secondary" />
            ) : (
              <ChevronLeft size={20} className="text-text-secondary" />
            )}
          </button>
          <h1 className="text-xl font-bold text-text-primary">{t('profile.language')}</h1>
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {LANGS.map((lang, idx) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code as 'ar' | 'en')}
              className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                idx > 0 ? 'border-t border-border' : ''
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div className="flex-1 text-start">
                <p className="font-semibold text-text-primary">{lang.label}</p>
                <p className="text-sm text-text-muted">{lang.nativeLabel}</p>
              </div>
              {language === lang.code && (
                <Check size={18} className="text-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
