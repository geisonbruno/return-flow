interface PaginationProps {
  /** Zero-based, matching the backend's `PageResponse.page`. */
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, totalElements, onPageChange }: PaginationProps) {
  const canGoPrevious = page > 0;
  const canGoNext = page + 1 < totalPages;

  return (
    <nav className="pagination" aria-label="Returns pagination">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={!canGoPrevious}>
        Previous
      </button>
      <span className="pagination__status">
        Page {page + 1} of {Math.max(totalPages, 1)} · {totalElements} total
      </span>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={!canGoNext}>
        Next
      </button>
    </nav>
  );
}
