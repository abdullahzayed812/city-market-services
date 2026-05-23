import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from 'react-i18next';

export function TermsModal() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sections = t('terms.sections', { returnObjects: true }) as { heading: string; body: string }[];

  useEffect(() => {
    const accepted = localStorage.getItem('citymarket_terms_accepted');
    if (accepted !== 'true') {
      setIsOpen(true);
    }
  }, []);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 20;
      if (isAtBottom) setHasScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    localStorage.setItem('citymarket_terms_accepted', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-primary p-6 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
                <Shield size={24} className="text-white" />
              </div>
              <h2 className="text-xl font-black tracking-tight">{t('terms.title')}</h2>
              <p className="text-white/80 text-xs mt-1 font-medium tracking-wide uppercase">{t('terms.lastUpdated')}</p>
            </div>
          </div>

          {/* Scrollable Content */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-6 space-y-6"
          >
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('terms.intro')}
            </p>

            <div className="space-y-5">
              {sections.map((section, idx) => (
                <div key={idx} className="space-y-1.5">
                  <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-primary-xlight text-primary text-[10px] flex items-center justify-center font-black">
                      {idx + 1}
                    </span>
                    {section.heading}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed pl-7">
                    {section.body}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm text-text-secondary font-medium italic pt-4 border-t border-gray-100">
              {t('terms.closing')}
            </p>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-border flex flex-col gap-3">
            {!hasScrolledToBottom && (
              <div className="flex items-center justify-center gap-1.5 text-text-muted text-xs font-bold mb-1 animate-bounce">
                <ChevronDown size={14} />
                {t('auth.scroll_to_read')}
              </div>
            )}
            <Button
              fullWidth
              size="lg"
              disabled={!hasScrolledToBottom}
              onClick={handleAccept}
              className="h-14 rounded-2xl shadow-primary-glow"
              iconRight={hasScrolledToBottom ? <CheckCircle2 size={18} /> : undefined}
            >
              {t('terms.accept')}
            </Button>
            <button
              onClick={() => window.location.href = 'about:blank'}
              className="text-sm font-bold text-error hover:text-error-dark transition-colors py-2"
            >
              {t('terms.decline')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
