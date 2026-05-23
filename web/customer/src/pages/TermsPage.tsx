import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';

export default function TermsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const sections = t('terms.sections', { returnObjects: true }) as Array<{ heading: string; body: string }>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} className={isRTL ? "rotate-180" : ""} />
        </button>
        <h1 className="text-2xl font-black text-text-primary">{t('terms.title')}</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-6 prose prose-sm max-w-none">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-xlight rounded-2xl flex items-center justify-center">
            <Shield size={24} className="text-primary" />
          </div>
          <div>
            <p className="font-bold text-text-primary">CityMarket</p>
            <p className="text-xs text-text-muted">{t('terms.lastUpdated')}</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
          <p>{t('terms.intro')}</p>

          {Array.isArray(sections) && sections.map((section, idx) => (
            <div key={idx}>
              <h3 className="font-bold text-text-primary">{idx + 1}. {section.heading}</h3>
              <p>{section.body}</p>
            </div>
          ))}

          <p className="text-xs text-text-muted italic mt-6">{t('terms.closing')}</p>
        </div>
      </div>
    </div>
  );
}
