import { useEffect, useMemo, useState } from "react";

// Pages a list that is already fully loaded. Goes back to page 1 whenever `resetKey`
// changes (i.e. the filters), and clamps the page when the list shrinks.
export function useClientPagination<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageItems = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize]);

  return { page: current, setPage, totalPages, pageItems, total: items.length };
}
