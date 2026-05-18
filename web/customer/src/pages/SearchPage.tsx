import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, SlidersHorizontal, PackageSearch } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CatalogService } from '@/services/api/catalogService';
import { ProductCard } from '@/components/shared/ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import type { Category } from '@/types';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState(params.get('categoryId') || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const newParams = new URLSearchParams();
    if (debouncedQuery) newParams.set('q', debouncedQuery);
    if (selectedCategory) newParams.set('categoryId', selectedCategory);
    setParams(newParams, { replace: true });
  }, [debouncedQuery, selectedCategory, setParams]);

  const { data: categories } = useQuery({
    queryKey: ['global-categories'],
    queryFn: CatalogService.getGlobalCategories,
  });

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['search', debouncedQuery, selectedCategory],
    queryFn: ({ pageParam }) =>
      CatalogService.searchVendorProducts({
        query: debouncedQuery || undefined,
        globalCategoryId: selectedCategory || undefined,
        page: pageParam,
        limit: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _, lastPageParam) =>
      lastPage.data?.length === 20 ? lastPageParam + 1 : undefined,
  });

  const products = data?.pages.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Search bar */}
      <div className="sticky top-16 z-20 bg-background pb-4 pt-1">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands, stores..."
            className="w-full h-13 pl-12 pr-12 bg-white rounded-2xl text-sm font-medium text-text-primary placeholder:text-text-muted shadow-card border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/20 transition-all"
          />
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Category filters */}
      {categories && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
          <button
            onClick={() => setSelectedCategory('')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              !selectedCategory
                ? 'bg-primary text-white shadow-primary-glow/30'
                : 'bg-white text-text-secondary hover:text-text-primary shadow-card border border-transparent'
            }`}
          >
            All
          </button>
          {categories.map((cat: Category) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-primary text-white shadow-primary-glow/30'
                  : 'bg-white text-text-secondary hover:text-text-primary shadow-card border border-transparent'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Results header */}
      {(debouncedQuery || selectedCategory) && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-text-muted">
            {isLoading ? 'Searching...' : `${products.length} result${products.length !== 1 ? 's' : ''}`}
            {debouncedQuery && (
              <span className="font-semibold text-text-primary"> for "{debouncedQuery}"</span>
            )}
          </p>
        </div>
      )}

      {/* Products grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-20 h-20 bg-primary-xlight rounded-full flex items-center justify-center mb-4">
            <PackageSearch size={36} className="text-primary" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">No products found</h3>
          <p className="text-sm text-text-muted max-w-xs">
            {debouncedQuery
              ? `We couldn't find anything matching "${debouncedQuery}". Try a different search.`
              : 'Start searching for products above'}
          </p>
          {debouncedQuery && (
            <button
              onClick={() => setQuery('')}
              className="mt-4 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              Clear Search
            </button>
          )}
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} showVendor />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-8 py-3 bg-white border border-border text-sm font-semibold text-text-secondary rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
