import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Package, Scale, Check } from 'lucide-react';
import { useState } from 'react';
import { getImageUrl, formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import { MeasurementType } from '@/types';
import type { VendorProduct } from '@/types';
import toast from 'react-hot-toast';

interface ProductCardProps {
  product: VendorProduct;
  showVendor?: boolean;
}

export function ProductCard({ product, showVendor = false }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const addToCart = useCartStore((s) => s.addToCart);
  const items = useCartStore((s) => s.items);

  const inCart = !!items.find((i) => i.id === product.id);
  const imageUrl = getImageUrl(product.imageUrl);
  const isWeight = product.measurementType === MeasurementType.WEIGHT;
  const defaultQty = isWeight ? 500 : 1;

  const stockAvailable = isWeight
    ? (product.stockWeightGrams || 0) > 0
    : (product.stockQuantity || 0) > 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!stockAvailable || added) return;

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      vendorId: product.vendorId,
      measurementType: product.measurementType,
      imageUrl: product.imageUrl,
      isAvailable: stockAvailable,
      ...(isWeight ? { weightGrams: defaultQty, weight: defaultQty / 1000 } : { quantity: defaultQty }),
    });

    setAdded(true);
    toast.success(`${product.name} added`, { duration: 1600 });
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <Link to={`/product/${product.id}`} className="block group">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-200 h-full flex flex-col"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <Package size={36} className="text-gray-200" />
            </div>
          )}

          {/* Weight badge */}
          {isWeight && (
            <div className="absolute top-2 left-2">
              <span className="flex items-center gap-1 bg-white/90 backdrop-blur-sm text-[10px] font-semibold text-text-secondary px-2 py-0.5 rounded-full shadow-soft">
                <Scale size={9} />
                /kg
              </span>
            </div>
          )}

          {/* Out of stock overlay */}
          {!stockAvailable && (
            <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
              <span className="text-xs font-bold text-text-muted bg-white px-3 py-1.5 rounded-full shadow-soft border border-border">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col flex-1">
          {product.globalCategoryName && (
            <span className="inline-block text-[10px] font-bold text-primary-darker bg-primary-xlight px-2 py-0.5 rounded-full mb-1.5 w-fit tracking-wide uppercase">
              {product.globalCategoryName}
            </span>
          )}

          <h3 className="font-semibold text-text-primary text-sm line-clamp-2 leading-snug mb-1 flex-1">
            {product.name}
          </h3>

          {showVendor && product.vendorName && (
            <p className="text-[11px] text-text-muted mb-2 truncate">{product.vendorName}</p>
          )}

          <div className="flex items-center justify-between mt-auto gap-2 pt-2">
            <div className="min-w-0">
              <span className="text-base font-black text-text-primary">
                {formatPrice(product.price)}
              </span>
              {isWeight && (
                <span className="text-[11px] text-text-muted ml-0.5">/kg</span>
              )}
            </div>

            {stockAvailable && (
              <motion.button
                onClick={handleAdd}
                whileTap={{ scale: 0.86 }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  added || inCart
                    ? 'bg-primary shadow-primary-glow/40'
                    : 'bg-primary-xlight hover:bg-primary group/btn'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {added ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check size={14} className="text-white" strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="plus"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Plus
                        size={15}
                        className={`transition-colors ${
                          inCart ? 'text-white' : 'text-primary group-hover/btn:text-white'
                        }`}
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
