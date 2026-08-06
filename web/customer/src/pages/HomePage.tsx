import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowRight, ChevronRight, TrendingUp, Clock, ShieldCheck, Truck, Star, Gift, ShoppingCart, Wheat, Store, Leaf, ChefHat } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CatalogService } from "@/services/api/catalogService";
import { VendorService } from "@/services/api/vendorService";
import { VendorCard } from "@/components/shared/VendorCard";
import { ProductCard } from "@/components/shared/ProductCard";
import { HomePageSkeleton } from "@/components/ui/Skeleton";
import { getImageUrl } from "@/lib/utils";
import type { Category, Vendor } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useTranslation } from "react-i18next";

const VENDOR_TYPE_ICON: Record<string, React.ElementType> = {
  SUPERMARKET: ShoppingCart,
  BAKERY: Wheat,
  BUTCHER: ChefHat,
  GROCERY: Store,
  FRUITS: Leaf,
};

const VENDOR_TYPE_COLOR: Record<string, string> = {
  SUPERMARKET: "#10B981",
  BAKERY: "#F59E0B",
  BUTCHER: "#EF4444",
  GROCERY: "#3B82F6",
  FRUITS: "#22C55E",
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function SectionHeader({ title, to, icon }: { title: string; to: string; icon?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-lg font-bold text-text-primary tracking-tight">{title}</h2>
      </div>
      <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-dark transition-colors">
        {t('common.see_all')} <ChevronRight size={15} />
      </Link>
    </div>
  );
}

function CategoryPill({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <motion.button whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.94 }} onClick={onPress} className="flex flex-col items-center gap-2 flex-shrink-0">
      <div className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden shadow-card transition-shadow hover:shadow-card-hover bg-white">
        {category.imageUrl ? (
          <img src={getImageUrl(category.imageUrl)} alt={category.name} className="w-[68px] h-[68px] object-contain" />
        ) : (
          <span className="text-3xl font-black" style={{ color: category.color || "#10B981" }}>
            {category.name[0]}
          </span>
        )}
      </div>
      <span className="text-xs font-semibold text-text-secondary text-center w-24 leading-tight line-clamp-2">{category.name}</span>
    </motion.button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ["global-categories"],
    queryFn: CatalogService.getGlobalCategories,
  });

  const { data: vendors = [], isLoading: vendorLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: VendorService.getVendors,
  });

  const { data: featuredProducts } = useQuery({
    queryKey: ["featured-products"],
    queryFn: () => CatalogService.searchVendorProducts({ limit: 12, page: 1 }),
  });

  const groupedVendors = useMemo(() => {
    const groups: Record<string, Vendor[]> = {};
    vendors.forEach((v) => {
      const type = v.type || "Other";
      if (!groups[type]) groups[type] = [];
      groups[type].push(v);
    });
    return Object.entries(groups).map(([type, items]) => ({ type, items }));
  }, [vendors]);

  const isLoading = catLoading || vendorLoading;

  const getVendorTypeLabel = (type: string): string => {
    const key = `home.type_${type.toLowerCase()}`;
    const translated = t(key);
    // If key not found, fallback to the type itself
    return translated === key ? type : translated;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    else navigate("/search");
  };

  if (isLoading) return <HomePageSkeleton />;

  return (
    <div className="animate-fade-in">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-hero-gradient">
        {/* Decorative background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-28 -right-28 w-[480px] h-[480px] rounded-full bg-white/[0.06]" />
          <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full bg-white/[0.05]" />
          <div className="absolute bottom-0 right-1/3 w-52 h-52 rounded-full bg-black/[0.04]" />
          {/* Dot grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.05]" viewBox="0 0 800 400">
            <defs>
              <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-2xl">
            {/* Live badge */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 }}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white/95 text-xs font-bold px-3.5 py-1.5 rounded-full mb-5 border border-white/20"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
              {t('home.promo_subtitle')}
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13, duration: 0.45 }}
              className="text-4xl sm:text-5xl font-black text-white leading-[1.08] mb-4 tracking-tight"
            >
              {isAuthenticated && user?.name ? (
                <>
                  <span className="text-white/60 text-lg sm:text-xl font-bold block mb-2 tracking-wide">
                    {t('home.welcome')} {user.name.split(" ")[0]} 👋
                  </span>
                  {t('home.hero_headline')}
                </>
              ) : (
                <>{t('home.hero_headline')}</>
              )}
              <br />
              <span className="text-accent">{t('home.hero_subline')}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-white/75 text-sm sm:text-base mb-8 max-w-md leading-relaxed"
            >
              {t('home.hero_description')}
            </motion.p>

            {/* Search bar */}
            <motion.form
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              onSubmit={handleSearch}
              className="flex gap-2 max-w-lg"
            >
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none rtl:left-auto rtl:right-4" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('home.search_placeholder')}
                  className="w-full h-12 pl-11 pr-4 rtl:pl-4 rtl:pr-11 bg-white rounded-2xl text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/50 shadow-float"
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                className="h-12 px-5 bg-accent text-white font-bold rounded-2xl shadow-accent-glow hover:bg-accent-dark transition-colors flex items-center gap-1.5 flex-shrink-0"
              >
                {t('common.search')}
                <ArrowRight size={15} />
              </motion.button>
            </motion.form>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/10 bg-black/[0.12] backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex divide-x divide-white/10">
              {[
                { icon: Clock, labelKey: "home.stat_delivery" },
                { icon: ShieldCheck, labelKey: "home.stat_quality" },
                { icon: Truck, labelKey: "home.stat_tracking" },
                { icon: Star, labelKey: "home.stat_vendors" },
              ].map(({ icon: Icon, labelKey }) => (
                <div key={labelKey} className="flex-1 flex items-center justify-center gap-2 py-3 sm:py-3.5">
                  <Icon size={14} className="text-white/70 flex-shrink-0" />
                  <span className="text-white/80 text-xs font-semibold hidden xs:block">{t(labelKey)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── Categories ── */}
        {categories.length > 0 && (
          <section className="py-8">
            <SectionHeader title={t('home.categories')} to="/search" />
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
              {categories.map((cat) => (
                <CategoryPill key={cat.id} category={cat} onPress={() => navigate(`/search?categoryId=${cat.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* ── Promo banner ── */}
        <section className="mb-8">
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="relative overflow-hidden rounded-3xl cursor-pointer bg-accent-gradient p-6 sm:p-8"
          >
            <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-white/10" />
            <div className="absolute -right-2 bottom-0 w-28 h-28 rounded-full bg-black/[0.06]" />

            <div className="relative z-10 flex items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-2 uppercase tracking-widest">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse-soft" />
                  {t('home.promo_tag')}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-1 tracking-tight">{t('home.promo_title')}</h3>
                <p className="text-white/80 text-sm">{t('home.promo_subtitle')}</p>
              </div>
              <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-white/15 rounded-2xl flex items-center justify-center">
                <Gift size={32} className="text-white" strokeWidth={1.5} />
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Vendor Groups ── */}
        {groupedVendors.map(({ type, items }) => {
          const VIcon = VENDOR_TYPE_ICON[type] || Store;
          const vColor = VENDOR_TYPE_COLOR[type] || "#10B981";
          return (
            <section key={type} className="mb-10">
              <SectionHeader
                title={getVendorTypeLabel(type)}
                to={`/stores?type=${type}`}
                icon={
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${vColor}18` }}>
                    <VIcon size={15} style={{ color: vColor }} strokeWidth={2} />
                  </div>
                }
              />

              {/* Desktop: grid */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {items.slice(0, 8).map((vendor) => (
                  <motion.div key={vendor.id} variants={staggerItem}>
                    <VendorCard vendor={vendor} />
                  </motion.div>
                ))}
              </motion.div>

              {/* Mobile: horizontal scroll */}
              <div className="flex md:hidden gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {items.map((vendor) => (
                  <div key={vendor.id} className="flex-shrink-0 w-48">
                    <VendorCard vendor={vendor} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* ── Trending Products ── */}
        {featuredProducts && featuredProducts.data?.length > 0 && (
          <section className="mb-10">
            <SectionHeader
              title={t('home.trending')}
              to="/search"
              icon={
                <div className="w-7 h-7 rounded-lg bg-primary-xlight flex items-center justify-center">
                  <TrendingUp size={15} className="text-primary" />
                </div>
              }
            />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
            >
              {featuredProducts.data.slice(0, 12).map((product) => (
                <motion.div key={product.id} variants={staggerItem}>
                  <ProductCard product={product} showVendor />
                </motion.div>
              ))}
            </motion.div>
          </section>
        )}
      </div>
    </div>
  );
}
