import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Trash2, Plus, Minus, Scale, ArrowRight, ShoppingCart } from "lucide-react";
import { useCartStore, selectCartTotal, selectCartItemCount } from "@/store/cartStore";
import { MeasurementType } from "@/types";
import { formatPrice, getImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import { useTranslation } from "react-i18next";

function CartItemRow({ item }: { item: any }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const updateWeight = useCartStore((s) => s.updateWeight);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const { t } = useTranslation();
  const isWeight = item.measurementType === MeasurementType.WEIGHT;
  const imageUrl = getImageUrl(item.imageUrl);

  const lineTotal = isWeight ? (item.price * (item.weightGrams || 0)) / 1000 : item.price * (item.quantity || 0);

  const handleIncrement = () => {
    if (isWeight) updateWeight(item.id, (item.weightGrams || 500) + 500);
    else updateQuantity(item.id, (item.quantity || 0) + 1);
  };

  const handleDecrement = () => {
    if (isWeight) {
      const next = (item.weightGrams || 500) - 500;
      if (next <= 0) removeFromCart(item.id);
      else updateWeight(item.id, next);
    } else {
      const next = (item.quantity || 0) - 1;
      if (next <= 0) removeFromCart(item.id);
      else updateQuantity(item.id, next);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
      className="flex gap-3 bg-white rounded-2xl p-3.5 shadow-card"
    >
      {/* Image */}
      <div className="w-[76px] h-[76px] rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <ShoppingBag size={24} className="text-gray-200" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h3 className="text-sm font-bold text-text-primary line-clamp-2 leading-snug flex-1">{item.name}</h3>
          <button
            onClick={() => removeFromCart(item.id)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-text-muted hover:bg-error-light hover:text-error transition-colors flex-shrink-0 mt-0.5"
          >
            <Trash2 size={12} />
          </button>
        </div>

        <p className="text-xs text-text-muted mb-3 flex items-center gap-1">
          {isWeight && <Scale size={10} />}
          {formatPrice(item.price)}
          {isWeight ? `/${t('common.kg')}` : ` ${t('cart.each')}`}
        </p>

        <div className="flex items-center justify-between">
          {/* Qty controls */}
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-0.5">
            <button
              onClick={handleDecrement}
              className="w-7 h-7 rounded-lg bg-white text-text-secondary flex items-center justify-center hover:bg-primary-xlight hover:text-primary transition-colors shadow-soft"
            >
              <Minus size={12} />
            </button>
            <span className="text-sm font-bold text-text-primary min-w-[44px] text-center">
              {isWeight ? `${((item.weightGrams || 0) / 1000).toFixed(1)}kg` : item.quantity}
            </span>
            <button
              onClick={handleIncrement}
              className="w-7 h-7 rounded-lg bg-white text-text-secondary flex items-center justify-center hover:bg-primary-xlight hover:text-primary transition-colors shadow-soft"
            >
              <Plus size={12} />
            </button>
          </div>

          <span className="font-black text-text-primary">{formatPrice(lineTotal)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function CartPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const items = useCartStore((s) => s.items);
  const total = useCartStore(selectCartTotal);
  const itemCount = useCartStore(selectCartItemCount);
  const clearCart = useCartStore((s) => s.clearCart);
  const { t } = useTranslation();

  const handleCheckout = () => navigate('/checkout');

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 flex flex-col items-center text-center">
        <div className="w-28 h-28 bg-primary-xlight rounded-full flex items-center justify-center mb-6">
          <ShoppingCart size={52} className="text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-black text-text-primary mb-2">{t('cart.empty')}</h2>
        <p className="text-text-muted text-sm mb-8 max-w-xs leading-relaxed">{t('cart.empty_subtitle')}</p>
        <Link to="/" className="px-8 py-3.5 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark transition-colors shadow-primary-glow/40">
          {t('home.stores')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">{t('cart.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {itemCount} {t('cart.items')}
          </p>
        </div>
        <button onClick={clearCart} className="text-sm font-semibold text-error hover:bg-error-light px-3 py-1.5 rounded-xl transition-colors">
          {t('cart.clear_all')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-3">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-card p-5 sticky top-24">
            <h2 className="text-base font-bold text-text-primary mb-4">{t('checkout.order_summary')}</h2>

            <div className="space-y-2.5 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">{t('cart.subtotal')} ({itemCount} items)</span>
                <span className="font-semibold text-text-primary">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">{t('checkout.delivery_fee')}</span>
                <span className="font-semibold text-primary text-xs">{t('cart.calculated_at_checkout')}</span>
              </div>
            </div>

            <div className="h-px bg-gray-100 mb-4" />

            <div className="flex justify-between items-baseline mb-5">
              <span className="font-bold text-text-primary">{t('cart.subtotal')}</span>
              <span className="text-2xl font-black text-primary">{formatPrice(total)}</span>
            </div>

            <Button fullWidth size="lg" onClick={handleCheckout} iconRight={<ArrowRight size={18} />}>
              {t('cart.checkout')}
            </Button>

            <div className="mt-3 text-center">
              <Link to="/" className="text-xs text-text-muted hover:text-primary transition-colors">
                {t('cart.continue_shopping')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
