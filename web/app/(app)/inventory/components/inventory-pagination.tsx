"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const PAGE_SIZES = [10, 20, 30, 50, 100];

export interface InventoryPaginationProps {
  pageIndex: number;
  pageSize: number;
  total: number;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function InventoryPagination({
  pageIndex,
  pageSize,
  total,
  onPageIndexChange,
  onPageSizeChange,
}: InventoryPaginationProps) {
  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);
  const canPrev = pageIndex > 0;
  const canNext = pageCount > 0 && pageIndex + 1 < pageCount;

  return (
    <div
      className="dt-footer"
      style={{ borderRadius: "0 0 var(--r-lg) var(--r-lg)" }}
    >
      <div className="dt-footer-meta">{total} row(s) total</div>
      <div className="dt-footer-controls">
        <label className="dt-page-size">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span className="dt-page-label">
          Page {total === 0 ? 0 : pageIndex + 1} of{" "}
          {total === 0 ? 0 : pageCount}
        </span>
        <div className="dt-page-nav">
          <button
            type="button"
            className="dt-btn dt-btn-icon"
            onClick={() => onPageIndexChange(0)}
            disabled={!canPrev}
            aria-label="First page"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-icon"
            onClick={() => onPageIndexChange(pageIndex - 1)}
            disabled={!canPrev}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-icon"
            onClick={() => onPageIndexChange(pageIndex + 1)}
            disabled={!canNext}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-icon"
            onClick={() => onPageIndexChange(pageCount - 1)}
            disabled={!canNext}
            aria-label="Last page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
