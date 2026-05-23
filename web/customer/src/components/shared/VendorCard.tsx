import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Clock, Bike, ShoppingCart, Wheat, Store, Leaf, ChefHat, Fish, Pill, Drumstick, Coffee } from "lucide-react";
import { getImageUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { VendorType } from "@/types";
import type { Vendor } from "@/types";

interface VendorCardProps {
  vendor: Vendor;
  variant?: "default" | "horizontal";
}

const TYPE_ICON: Record<string, React.ElementType> = {
  [VendorType.Supermarket]: ShoppingCart,
  [VendorType.Bakery]: Wheat,
  [VendorType.Butcher]: ChefHat,
  [VendorType.VegFruit]: Leaf,
  [VendorType.Pharmacy]: Pill,
  [VendorType.Poultry]: Drumstick,
  [VendorType.Fish]: Fish,
  [VendorType.Roastery]: Coffee,
  [VendorType.Pastry]: Wheat,
  [VendorType.Stationery]: Store,
};

const TYPE_COLOR: Record<string, string> = {
  [VendorType.Supermarket]: "#10B981",
  [VendorType.Bakery]: "#F59E0B",
  [VendorType.Butcher]: "#EF4444",
  [VendorType.VegFruit]: "#22C55E",
  [VendorType.Pharmacy]: "#3B82F6",
  [VendorType.Poultry]: "#F97316",
  [VendorType.Fish]: "#06B6D4",
  [VendorType.Roastery]: "#92400E",
  [VendorType.Pastry]: "#EC4899",
  [VendorType.Stationery]: "#8B5CF6",
};

const TYPE_KEY: Record<string, string> = {
  [VendorType.Supermarket]: "home.type_supermarket",
  [VendorType.Bakery]: "home.type_bakery",
  [VendorType.Butcher]: "home.type_butcher",
  [VendorType.VegFruit]: "home.type_vegfruit",
  [VendorType.Pharmacy]: "home.type_pharmacy",
  [VendorType.Poultry]: "home.type_poultry",
  [VendorType.Fish]: "home.type_fish",
  [VendorType.Roastery]: "home.type_roastery",
  [VendorType.Pastry]: "home.type_pastry",
  [VendorType.Stationery]: "home.type_stationery",
};

export function VendorCard({ vendor, variant = "default" }: VendorCardProps) {
  const { t } = useTranslation();
  const imageUrl = getImageUrl(vendor.storeImage);
  const isOpen = vendor.isOpen !== false;
  const VendorIcon = TYPE_ICON[vendor.type || ""] || Store;
  const iconColor = TYPE_COLOR[vendor.type || ""] || "#10B981";
  const typeLabel = vendor.type ? t(TYPE_KEY[vendor.type] ?? `home.type_other`) : "";

  if (variant === "horizontal") {
    return (
      <Link to={`/store/${vendor.id}`}>
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200 flex gap-3 p-3"
        >
          <div className="w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 relative">
            {imageUrl ? (
              <img src={imageUrl} alt={vendor.shopName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${iconColor}15` }}>
                <VendorIcon size={28} style={{ color: iconColor }} strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 py-0.5">
            <h3 className="font-bold text-text-primary text-sm line-clamp-1 mb-0.5">{vendor.shopName}</h3>
            <p className="text-xs text-text-muted capitalize mb-2">{typeLabel}</p>
            <div className="flex items-center gap-3">
              {vendor.rating != null && (
                <span className="flex items-center gap-1 text-xs">
                  <Star size={11} className="fill-accent text-accent" />
                  <span className="font-bold text-text-primary">{Number(vendor.rating).toFixed(1)}</span>
                </span>
              )}
              {vendor.estimatedDeliveryTime && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Clock size={11} />
                  {vendor.estimatedDeliveryTime} {t('common.minutes')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-start pt-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpen ? "bg-success/10 text-success" : "bg-gray-100 text-text-muted"}`}>
              {isOpen ? t('home.open') : t('home.closed')}
            </span>
          </div>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link to={`/store/${vendor.id}`} className="block group">
      <motion.div
        whileHover={{ y: -5 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-200"
      >
        {/* Image */}
        <div className="relative h-40 bg-gray-100 overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={vendor.shopName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.07]" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${iconColor}12` }}>
              <VendorIcon size={52} style={{ color: iconColor }} strokeWidth={1.2} />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Open/Closed badge */}
          <div className="absolute top-2.5 right-2.5">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm border ${
                isOpen ? "bg-success/80 text-white border-success/20" : "bg-black/50 text-white/80 border-white/10"
              }`}
            >
              {isOpen ? t('home.open') : t('home.closed')}
            </span>
          </div>

          {/* Type chip */}
          <div className="absolute top-2.5 left-2.5">
            <div
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm"
              style={{ backgroundColor: `${iconColor}CC`, color: "#fff" }}
            >
              <VendorIcon size={9} strokeWidth={2.5} />
              {typeLabel}
            </div>
          </div>

          {/* Store name on image */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
            <h3 className="font-bold text-white text-sm line-clamp-1 drop-shadow">{vendor.shopName}</h3>
          </div>
        </div>

        {/* Meta row */}
        <div className="px-3 py-3 flex items-center gap-3">
          {vendor.rating != null ? (
            <span className="flex items-center gap-1 text-xs">
              <Star size={12} className="fill-accent text-accent" />
              <span className="font-bold text-text-primary">{Number(vendor.rating).toFixed(1)}</span>
              {vendor.reviewCount ? <span className="text-text-muted">({vendor.reviewCount})</span> : null}
            </span>
          ) : null}
          {vendor.estimatedDeliveryTime ? (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Bike size={12} />
              {vendor.estimatedDeliveryTime} {t('common.minutes')}
            </span>
          ) : null}
          {!vendor.rating && !vendor.estimatedDeliveryTime && <span className="text-xs text-text-muted">{t('store.view_store')}</span>}
        </div>
      </motion.div>
    </Link>
  );
}
