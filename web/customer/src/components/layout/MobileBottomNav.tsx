import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ShoppingCart, ClipboardList, User, Search } from 'lucide-react';
import { useCartStore, selectCartItemCount } from '@/store/cartStore';

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/cart', label: 'Cart', icon: ShoppingCart },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/profile', label: 'Profile', icon: User },
];

export function MobileBottomNav() {
  const location = useLocation();
  const cartCount = useCartStore(selectCartItemCount);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 safe-area-pb">
      {/* Frosted bar */}
      <div className="glass border-t border-white/60 shadow-nav">
        <div className="flex items-center h-[60px] px-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive = location.pathname === href;
            const isCart = href === '/cart';

            return (
              <Link
                key={href}
                to={href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 relative"
              >
                {/* Active pill background */}
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-pill"
                    className="absolute inset-1 bg-primary/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                <div className="relative z-10 w-6 h-6 flex items-center justify-center">
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className={`transition-colors duration-200 ${
                      isActive ? 'text-primary' : 'text-slate-400'
                    }`}
                  />
                  {isCart && cartCount > 0 && (
                    <AnimatePresence>
                      <motion.span
                        key="cart-badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 min-w-[16px] h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center px-1 border-2 border-white"
                      >
                        {cartCount > 99 ? '99+' : cartCount}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </div>

                <span
                  className={`text-[10px] font-semibold relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
