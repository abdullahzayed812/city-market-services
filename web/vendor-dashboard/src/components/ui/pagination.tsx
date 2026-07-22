import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  const delta = 1
  const range: (number | "ellipsis")[] = []
  const left = Math.max(2, current - delta)
  const right = Math.min(total - 1, current + delta)

  range.push(1)
  if (left > 2) range.push("ellipsis")
  for (let i = left; i <= right; i++) range.push(i)
  if (right < total - 1) range.push("ellipsis")
  if (total > 1) range.push(total)
  return range
}

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  ({ currentPage, totalPages, onPageChange, className, ...props }, ref) => {
    if (totalPages <= 1) return null
    const pages = getPageNumbers(currentPage, totalPages)

    const goTo = (page: number) => {
      onPageChange(page)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }

    return (
      <nav
        ref={ref}
        aria-label="pagination"
        className={cn("flex items-center justify-center gap-1", className)}
        {...props}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>

        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span
              key={`e-${i}`}
              className="flex h-10 w-10 items-center justify-center text-sm text-muted-foreground"
            >
              &#8230;
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="icon"
              onClick={() => goTo(p)}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </nav>
    )
  }
)
Pagination.displayName = "Pagination"

export { Pagination }
