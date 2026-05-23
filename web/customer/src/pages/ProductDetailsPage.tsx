import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ShoppingCart, Plus, Minus, Scale, Package, Store, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CatalogService } from "@/services/api/catalogService";
import { VendorService } from "@/services/api/vendorService";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/store/cartStore";
import { MeasurementType } from "@/types";
import { getImageUrl, formatPrice } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import toast from "react-hot-toast";

export default function ProductDetailsPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const addToCart = useCartStore((s) => s.addToCart);
  const items = useCartStore((s) => s.items);
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [amount, setAmount] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => CatalogService.getVendorProductById(productId!),
    enabled: !!productId,
  });

  const { data: vendor } = useQuery({
    queryKey: ["vendor", product?.vendorId],
    queryFn: () => VendorService.getVendorById(product!.vendorId),
    enabled: !!product?.vendorId,
  });

  const isWeight = product?.measurementType === MeasurementType.WEIGHT;

  useEffect(() => {
    if (product) {
      setAmount(isWeight ? 500 : 1);
    }
  }, [product, isWeight]);

  const stockAvailable = product ? (isWeight ? (product.stockWeightGrams || 0) > 0 : (product.stockQuantity || 0) > 0) : false;

  const maxAmount = product ? (isWeight ? product.stockWeightGrams || 0 : product.stockQuantity || 0) : 0;

  const inCart = items.find((i) => i.id === productId);

  const handleIncrement = () => {
    if (isWeight) setAmount((p) => (p + 500 <= maxAmount ? p + 500 : p));
    else setAmount((p) => (p + 1 <= maxAmount ? p + 1 : p));
  };

  const handleDecrement = () => {
    if (isWeight) setAmount((p) => (p > 500 ? p - 500 : 500));
    else setAmount((p) => (p > 1 ? p - 1 : 1));
  };

  const handleAddToCart = () => {
    if (!product || !stockAvailable) return;
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      vendorId: product.vendorId,
      measurementType: product.measurementType,
      imageUrl: product.imageUrl,
      isAvailable: stockAvailable,
      ...(isWeight ? { weightGrams: amount, weight: amount / 1000 } : { quantity: amount }),
    });
    toast.success(t('store.added_to_cart'));
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <Skeleton className="w-full h-72 rounded-3xl mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <AlertCircle size={48} className="text-error mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">{t('store.not_found')}</h2>
        <button onClick={() => navigate(-1)} className="text-primary font-semibold text-sm">
          {t('common.go_back')}
        </button>
      </div>
    );
  }

  const imageUrl = getImageUrl(product.imageUrl);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Back btn */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary text-sm font-semibold mb-6 transition-colors"
      >
        <ChevronLeft size={18} className={isRTL ? "rotate-180" : ""} />
        {t('common.go_back')}
      </button>

      <div className="bg-white rounded-3xl shadow-card overflow-hidden">
        {/* Hero image */}
        <div className="relative aspect-video bg-gray-50">
          {imageUrl ? (
            <img src={imageUrl} alt={product.name} className="w-full h-full object-contain p-4" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={72} className="text-gray-200" />
            </div>
          )}
          {!stockAvailable && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white text-text-primary font-bold px-5 py-2.5 rounded-xl shadow-medium">{t('store.out_of_stock')}</span>
            </div>
          )}
          {isWeight && (
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm text-xs font-bold text-text-secondary px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-soft">
              <Scale size={12} />
              {t('store.sold_by_weight')}
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Title & Price */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-xl font-black text-text-primary leading-tight flex-1">{product.name}</h1>
            <div className="text-right flex-shrink-0">
              <span className="text-2xl font-black text-primary">{formatPrice(product.price)}</span>
              {isWeight && <span className="text-sm text-text-muted ml-1">/{t('common.kg')}</span>}
            </div>
          </div>

          {/* Stock status */}
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2 h-2 rounded-full ${stockAvailable ? "bg-success" : "bg-error"}`} />
            <span className={`text-sm font-semibold ${stockAvailable ? "text-success" : "text-error"}`}>
              {stockAvailable ? t('product.in_stock') : t('store.out_of_stock')}
            </span>
            {stockAvailable && isWeight && <span className="text-xs text-text-muted">· {((product.stockWeightGrams || 0) / 1000).toFixed(1)}{t('common.kg')} {t('product.available')}</span>}
            {stockAvailable && !isWeight && <span className="text-xs text-text-muted">· {product.stockQuantity} {t('product.available')}</span>}
          </div>

          {/* Store link */}
          {vendor && (
            <Link to={`/store/${vendor.id}`} className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors mb-4">
              <Store size={14} />
              <span className="font-semibold">{vendor.shopName}</span>
            </Link>
          )}

          {/* Description */}
          {product.description && (
            <>
              <div className="h-px bg-border mb-4" />
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide mb-2">{t('common.description')}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{product.description}</p>
            </>
          )}

          {/* Quantity selector */}
          {stockAvailable && (
            <>
              <div className="h-px bg-border my-5" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text-primary mb-0.5">
                    {isWeight ? t('product.weight') : t('product.quantity')}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {isWeight ? `${(amount / 1000).toFixed(1)} ${t('common.kg')} ${t('product.selected')}` : `${amount} ${t('cart.items')} ${t('product.selected')}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleDecrement}
                    className="w-10 h-10 rounded-xl bg-primary-xlight text-primary flex items-center justify-center hover:bg-primary-light transition-colors"
                  >
                    <Minus size={16} />
                  </motion.button>
                  <span className="text-lg font-bold text-text-primary min-w-[3rem] text-center">
                    {isWeight ? `${(amount / 1000).toFixed(1)}kg` : amount}
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleIncrement}
                    disabled={amount >= maxAmount}
                    className="w-10 h-10 rounded-xl bg-primary-xlight text-primary flex items-center justify-center hover:bg-primary-light transition-colors disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </motion.button>
                </div>
              </div>
            </>
          )}

          {/* Add to cart */}
          <div className="mt-6">
            <Button fullWidth size="lg" onClick={handleAddToCart} disabled={!stockAvailable} icon={<ShoppingCart size={18} />}>
              {inCart ? t('store.add_to_cart') : t('store.add_to_cart')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
