import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { VendorService } from '@/services/api/vendorService';
import { VendorCard } from '@/components/shared/VendorCard';
import { VendorCardSkeleton } from '@/components/ui/Skeleton';

const VENDOR_TYPES = ['All', 'SUPERMARKET', 'BAKERY', 'BUTCHER', 'GROCERY', 'FRUITS'];
const TYPE_LABELS: Record<string, string> = {
  All: 'All',
  SUPERMARKET: 'Supermarkets',
  BAKERY: 'Bakeries',
  BUTCHER: 'Butchers',
  GROCERY: 'Groceries',
  FRUITS: 'Fruits & Veg',
};

export default function StoresPage() {
  const [params] = useSearchParams();
  const [activeType, setActiveType] = useState(params.get('type') || 'All');

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: VendorService.getVendors,
  });

  const filtered = useMemo(() => {
    if (activeType === 'All') return vendors;
    return vendors.filter((v) => v.type === activeType);
  }, [vendors, activeType]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-text-primary tracking-tight mb-1">All Stores</h1>
        <p className="text-sm text-text-muted">
          {filtered.length} store{filtered.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Type filters */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 mb-6">
        {VENDOR_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeType === type
                ? 'bg-primary text-white shadow-primary-glow/30'
                : 'bg-white text-text-secondary hover:text-text-primary shadow-card border border-transparent'
            }`}
          >
            {TYPE_LABELS[type] || type}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <VendorCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-20 h-20 bg-primary-xlight rounded-full flex items-center justify-center mb-4">
            <Store size={36} className="text-primary" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">No stores found</h3>
          <p className="text-sm text-text-muted">
            No stores available in this category yet.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      )}
    </div>
  );
}
