import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton rounded-xl', className)} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-card">
      <Skeleton className="w-full h-44" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between items-center mt-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function VendorCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-card">
      <Skeleton className="w-full h-36" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Hero skeleton */}
      <Skeleton className="w-full h-56 mb-6 rounded-none" />
      {/* Categories */}
      <div className="px-4 mb-6">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2">
              <Skeleton className="w-16 h-16 rounded-2xl" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      {/* Vendor section */}
      <div className="px-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <VendorCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
