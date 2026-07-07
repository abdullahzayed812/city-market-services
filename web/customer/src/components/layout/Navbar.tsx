import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, User, Bell, Menu, X, ChevronDown,
  LogOut, MapPin, ClipboardList, Home, Store, ShoppingBag,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCartStore, selectCartItemCount } from '@/store/cartStore';
import { useQuery } from '@tanstack/react-query';
import { NotificationService } from '@/services/api/notificationService';
import { AuthService } from '@/services/api/authService';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import toast from 'react-hot-toast';

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, signOut } = useAuthStore();
  const itemCount = useCartStore(selectCartItemCount);
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();

  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => NotificationService.getNotifications(1, 1),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const unreadCount = notifData?.unread ?? 0;

  const handleSignOut = async () => {
    try {
      await AuthService.logout();
    } catch {}
    signOut();
    toast.success(t('common.logout'));
    navigate('/');
    setUserMenuOpen(false);
  };

  const navLinks = [
    { href: '/', label: t('home.title'), icon: Home },
    { href: '/stores', label: t('home.stores'), icon: Store },
    { href: '/search', label: t('common.search'), icon: Search },
    { href: '/orders', label: t('orders.title'), icon: ClipboardList },
  ];

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-40 glass border-b border-gray-100/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-9 h-9 bg-primary-gradient rounded-xl flex items-center justify-center shadow-primary-glow/50 group-hover:shadow-primary-glow transition-shadow">
              <ShoppingBag size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-xl text-text-primary tracking-tight">
              City<span className="gradient-text">Market</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => {
              const isActive = location.pathname === href;
              return (
                <Link
                  key={href}
                  to={href}
                  className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'text-primary'
                      : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
                  }`}
                >
                  {label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-primary/8 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Search button (desktop) */}
            <Link
              to="/search"
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors"
            >
              <Search size={18} />
            </Link>

            {/* Language toggle */}
            <button
              onClick={() => changeLanguage(language === 'ar' ? 'en' : 'ar')}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors font-bold text-xs"
              title={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
            >
              {language === 'ar' ? 'EN' : 'عربي'}
            </button>

            {/* Notifications */}
            {isAuthenticated && (
              <Link
                to="/notifications"
                className="relative w-9 h-9 hidden sm:flex items-center justify-center rounded-xl text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors"
              >
                <Bell size={18} />
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      key="notif-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-error text-white text-[9px] font-bold flex items-center justify-center px-1 border-2 border-white"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )}

            {/* Cart */}
            <Link
              to="/cart"
              className="relative w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors"
            >
              <ShoppingCart size={18} />
              <AnimatePresence>
                {itemCount > 0 && (
                  <motion.span
                    key="cart-badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center px-1 border-2 border-white"
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>

            {/* User menu or login */}
            {isAuthenticated ? (
              <div className="relative hidden sm:block ml-1">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary-gradient flex items-center justify-center shadow-sm">
                    <span className="text-white font-bold text-[11px]">{initials}</span>
                  </div>
                  <span className="text-sm font-semibold text-text-primary max-w-[80px] truncate hidden lg:block">
                    {user?.name?.split(' ')[0] || 'Account'}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`text-text-muted transition-transform hidden lg:block ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.14, ease: 'easeOut' }}
                        className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-large border border-gray-100 overflow-hidden z-20"
                      >
                        <div className="px-4 py-3 bg-gradient-to-br from-primary/5 to-transparent border-b border-gray-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-gradient flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-bold text-xs">{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-text-primary truncate">{user?.name}</p>
                              <p className="text-xs text-text-muted truncate">{user?.email}</p>
                            </div>
                          </div>
                        </div>
                        <div className="py-1">
                          {[
                            { to: '/profile', icon: User, label: t('profile.title') },
                            { to: '/orders', icon: ClipboardList, label: t('orders.title') },
                            { to: '/addresses', icon: MapPin, label: t('profile.addresses') },
                            { to: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
                          ].map(({ to, icon: Icon, label, badge }) => (
                            <Link
                              key={to}
                              to={to}
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-gray-50 hover:text-text-primary transition-colors"
                            >
                              <Icon size={15} className="text-text-muted" />
                              {label}
                              {badge && badge > 0 ? (
                                <span className="ml-auto bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                  {badge}
                                </span>
                              ) : null}
                            </Link>
                          ))}
                        </div>
                        <div className="border-t border-gray-100 py-1">
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-error hover:bg-error-light transition-colors"
                          >
                            <LogOut size={15} />
                            {t('common.logout')}
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 ml-1">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-primary hover:bg-gray-50 rounded-xl transition-colors"
                >
                  {t('common.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors shadow-primary-glow/40"
                >
                  {t('common.register')}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-gray-100 transition-colors ml-1"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <AnimatePresence mode="wait" initial={false}>
                {menuOpen ? (
                  <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <X size={20} />
                  </motion.span>
                ) : (
                  <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Menu size={20} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-gray-100 bg-white/95 backdrop-blur-sm"
          >
            <div className="px-4 py-3 space-y-0.5">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    location.pathname === href
                      ? 'bg-primary/8 text-primary'
                      : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
                  }`}
                >
                  <Icon size={18} className={location.pathname === href ? 'text-primary' : 'text-text-muted'} />
                  {label}
                </Link>
              ))}
              <div className="h-px bg-gray-100 my-1" />
              {isAuthenticated ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-text-secondary hover:bg-gray-50 transition-colors"
                  >
                    <User size={18} className="text-text-muted" />
                    {t('profile.title')}
                  </Link>
                  <Link
                    to="/notifications"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-text-secondary hover:bg-gray-50 transition-colors"
                  >
                    <Bell size={18} className="text-text-muted" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-semibold text-error hover:bg-error-light transition-colors"
                  >
                    <LogOut size={18} />
                    {t('common.logout')}
                  </button>
                </>
              ) : (
                <div className="flex gap-2 pt-1 pb-1">
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex-1 py-3 text-center text-sm font-semibold text-primary border-2 border-primary rounded-xl hover:bg-primary-xlight transition-colors"
                  >
                    {t('common.login')}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="flex-1 py-3 text-center text-sm font-bold bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    {t('common.register')}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
