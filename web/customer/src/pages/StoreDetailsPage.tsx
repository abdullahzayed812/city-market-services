import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Clock, MapPin, ChevronRight, Package, ArrowLeft, ShoppingCart, ChevronLeft, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { VendorService } from "@/services/api/vendorService";
import { CatalogService } from "@/services/api/catalogService";
import { RatingService } from "@/services/api/ratingService";
import { ProductCard } from "@/components/shared/ProductCard";
import { ProductCardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useCartStore, selectCartTotal, selectCartItemCount } from "@/store/cartStore";
import { getImageUrl, formatPrice } from "@/lib/utils";

export default function StoreDetailsPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: () => VendorService.getVendorById(vendorId!),
    enabled: !!vendorId,
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ["vendor-categories", vendorId],
    queryFn: () => CatalogService.getVendorCategories(vendorId!),
    enabled: !!vendorId,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["vendor-products", vendorId, activeCategory],
    queryFn: () => CatalogService.getVendorProductsByVendor(vendorId!, 1, 20, activeCategory || undefined),
    enabled: !!vendorId,
  });

  const { data: ratingSummary } = useQuery({
    queryKey: ["vendor-rating", vendorId],
    queryFn: () => RatingService.getSummary(vendorId!),
    enabled: !!vendorId,
  });

  const items = useCartStore((s) => s.items);
  const cartTotal = useCartStore(selectCartTotal);
  const cartCount = useCartStore(selectCartItemCount);
  const vendorCartItems = items.filter((i) => i.vendorId === vendorId);
  const hasCartItems = vendorCartItems.length > 0;

  const products = productsData?.data ?? [];
  const imageUrl = getImageUrl(vendor?.storeImage);

  if (vendorLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Skeleton className="w-full h-56 rounded-3xl mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Hero */}
      <div className="relative h-52 sm:h-64 rounded-none sm:rounded-3xl overflow-hidden -mx-4 sm:mx-0 mb-6 mt-0 sm:mt-6">
        {imageUrl ? (
          <img src={imageUrl} alt={vendor?.shopName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-emerald-100 flex items-center justify-center">
            <Package size={60} className="text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Back btn */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 bg-black/30 backdrop-blur-sm text-white rounded-xl flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Vendor info overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-sm">{vendor?.shopName}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${vendor?.isOpen !== false ? "bg-success/90 text-white" : "bg-black/50 text-white"}`}>
              {vendor?.isOpen !== false ? "Open Now" : "Closed"}
            </span>
            {ratingSummary?.data?.averageRating && (
              <span className="flex items-center gap-1 text-white text-sm font-semibold">
                <Star size={13} className="fill-accent text-accent" />
                {Number(ratingSummary.data.averageRating).toFixed(1)}
              </span>
            )}
            {vendor?.estimatedDeliveryTime && (
              <span className="flex items-center gap-1 text-white/80 text-xs">
                <Clock size={12} />
                {vendor.estimatedDeliveryTime} min
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-6 pb-20 md:pb-8">
        {/* Categories sidebar (desktop) */}
        {categories.length > 0 && (
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-card overflow-hidden sticky top-24">
              <div className="p-4 border-b border-border">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Categories</h3>
              </div>
              <nav className="py-2">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors text-left ${
                    !activeCategory ? "bg-primary-xlight text-primary" : "text-text-secondary hover:bg-gray-50"
                  }`}
                >
                  All Products
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors text-left ${
                      activeCategory === cat.id ? "bg-primary-xlight text-primary" : "text-text-secondary hover:bg-gray-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || "#10B981" }} />
                    {cat.name}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Mobile category scroll */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 lg:hidden mb-4">
              <button
                onClick={() => setActiveCategory(null)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  !activeCategory ? "bg-primary text-white shadow-soft" : "bg-white text-text-secondary border border-border"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    activeCategory === cat.id ? "bg-primary text-white shadow-soft" : "bg-white text-text-secondary border border-border"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Reviews link */}
          <Link
            to={`/store/${vendorId}/reviews`}
            className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-card mb-5 hover:shadow-medium transition-shadow"
          >
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Star size={18} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-text-primary">Customer Reviews</p>
              {ratingSummary?.data?.averageRating ? (
                <p className="text-xs text-text-muted">
                  {Number(ratingSummary.data.averageRating).toFixed(1)} stars · {ratingSummary.data.totalRatings || 0} reviews
                </p>
              ) : (
                <p className="text-xs text-text-muted">No reviews yet</p>
              )}
            </div>
            <ChevronRight size={18} className="text-text-muted" />
          </Link>

          {/* Products */}
          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package size={48} className="text-primary/30 mb-3" />
              <p className="text-base font-bold text-text-primary">No products yet</p>
              <p className="text-sm text-text-muted mt-1">This {activeCategory ? "category" : "store"} has no products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating cart bar */}
      <AnimatePresence>
        {hasCartItems && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-auto z-20"
          >
            <Link
              to="/cart"
              className="flex items-center justify-between gap-4 bg-primary-gradient text-white px-5 py-4 rounded-2xl shadow-large shadow-primary-glow/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingCart size={16} />
                </div>
                <span className="font-bold text-sm">
                  {cartCount} item{cartCount !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="font-black text-lg">{formatPrice(cartTotal)}</span>
              <div className="flex items-center gap-1 font-bold text-sm bg-white/15 px-3 py-1.5 rounded-xl">
                View Cart <ChevronRight size={15} />
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
