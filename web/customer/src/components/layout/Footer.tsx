import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

export function Footer() {
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
              Fresh groceries and everyday essentials delivered fast to your door.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
              All systems operational
            </div>
          </div>

          {/* Links */}
          {[
            {
              title: 'Shop',
              links: [
                { to: '/stores', label: 'All Stores' },
                { to: '/search', label: 'Search Products' },
                { to: '/stores?type=SUPERMARKET', label: 'Supermarkets' },
                { to: '/stores?type=BAKERY', label: 'Bakeries' },
              ],
            },
            {
              title: 'Account',
              links: [
                { to: '/profile', label: 'My Profile' },
                { to: '/orders', label: 'My Orders' },
                { to: '/addresses', label: 'Addresses' },
                { to: '/notifications', label: 'Notifications' },
              ],
            },
            {
              title: 'Legal',
              links: [
                { to: '/terms', label: 'Terms & Conditions' },
                { to: '/terms', label: 'Privacy Policy' },
              ],
            },
          ].map(({ title, links }) => (
            <div key={title}>
              <h4 className="font-bold text-text-primary mb-4 text-sm">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(({ to, label }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="text-sm text-text-muted hover:text-primary transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-sm text-text-muted">
            © {new Date().getFullYear()} CityMarket. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>Fresh</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>Fast</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>Reliable</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
