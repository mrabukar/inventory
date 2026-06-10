"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  rowCount: number;
}

const PAGE_SIZES = [10, 20, 30, 50, 100];

export function DataTablePagination<TData>({
  table,
  rowCount,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const selected = table.getFilteredSelectedRowModel().rows.length;
  const pageCount = table.getPageCount();

  return (
    <div className="dt-footer">
      <div className="dt-footer-meta">
        {selected > 0
          ? `${selected} of ${rowCount} row(s) selected`
          : `${rowCount} row(s) total`}
      </div>
      <div className="dt-footer-controls">
        <label className="dt-page-size">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span className="dt-page-label">
          Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
        </span>
        <div className="dt-page-nav">
          <button
            type="button"
            className="dt-btn dt-btn-icon"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="First page"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-icon"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Last page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
