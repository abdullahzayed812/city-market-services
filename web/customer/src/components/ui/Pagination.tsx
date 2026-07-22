import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  const delta = 1;
  const range: (number | 'ellipsis')[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push('ellipsis');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push('ellipsis');
  if (total > 1) range.push(total);
  return range;
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = getPageNumbers(currentPage, totalPages);

  const goTo = (p: number) => {
    onPageChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className={cn('flex items-center justify-center gap-1.5', className)} aria-label="Pagination">
      <button
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-border bg-white text-text-secondary hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors rtl:rotate-180"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-text-muted text-sm">
            &hellip;
          </span>
        ) : (
          <button
            key={p}
            onClick={() => goTo(p)}
            aria-current={p === currentPage ? 'page' : undefined}
            className={cn(
              'h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-xl text-sm font-semibold transition-colors',
              p === currentPage
                ? 'bg-primary text-white shadow-primary-glow/30'
                : 'bg-white text-text-secondary border border-border hover:bg-gray-50',
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-border bg-white text-text-secondary hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors rtl:rotate-180"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
