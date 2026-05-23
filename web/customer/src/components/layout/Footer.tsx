import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();

  const sections = [
    {
      titleKey: 'footer.shop_title',
      links: [
        { to: '/stores', labelKey: 'footer.all_stores' },
        { to: '/search', labelKey: 'footer.search_products' },
        { to: '/stores?type=SUPERMARKET', labelKey: 'footer.supermarkets' },
        { to: '/stores?type=BAKERY', labelKey: 'footer.bakeries' },
      ],
    },
    {
      titleKey: 'footer.account_title',
      links: [
        { to: '/profile', labelKey: 'footer.my_profile' },
        { to: '/orders', labelKey: 'footer.my_orders' },
        { to: '/addresses', labelKey: 'footer.my_addresses' },
        { to: '/notifications', labelKey: 'footer.my_notifications' },
      ],
    },
    {
      titleKey: 'footer.legal_title',
      links: [
        { to: '/terms', labelKey: 'footer.terms' },
        { to: '/terms', labelKey: 'footer.privacy' },
      ],
    },
  ];

  return (
    <footer className="hidden md:block bg-white border-t border-gray-100 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4 w-fit">
              <div className="w-9 h-9 bg-primary-gradient rounded-xl flex items-center justify-center shadow-primary-glow/30">
                <ShoppingBag size={17} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-black text-xl text-text-primary">
                City<span className="gradient-text">Market</span>
              </span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
              {t('footer.all_systems')}
            </div>
          </div>

          {/* Links */}
          {sections.map(({ titleKey, links }) => (
            <div key={titleKey}>
              <h4 className="font-bold text-text-primary mb-4 text-sm">{t(titleKey)}</h4>
              <ul className="space-y-2.5">
                {links.map(({ to, labelKey }) => (
                  <li key={labelKey}>
                    <Link
                      to={to}
                      className="text-sm text-text-muted hover:text-primary transition-colors"
                    >
                      {t(labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-sm text-text-muted">
            © {new Date().getFullYear()} {t('footer.copyright')}
          </p>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>{t('footer.fresh')}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>{t('footer.fast')}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>{t('footer.reliable')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
