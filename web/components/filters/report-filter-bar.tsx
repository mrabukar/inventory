"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { CategoryFilter } from "./category-filter";
import { DateRangeFilter } from "./date-range-filter";
import { BranchFilter } from "./branch-filter";
import { StoreFilter } from "./store-filter";

interface ReportFilterBarProps {
  filters: ReportFilters;
  showCategoryFilter?: boolean;
  showStoreFilter?: boolean;
  showBranchFilter?: boolean;
  disabled?: boolean;
}

export function ReportFilterBar({
  filters,
  showCategoryFilter = false,
  showStoreFilter = true,
  showBranchFilter = false,
  disabled = false,
}: ReportFilterBarProps) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <DateRangeFilter filters={filters} disabled={disabled} />
      {showStoreFilter ? (
        <StoreFilter filters={filters} disabled={disabled} />
      ) : null}
      {showBranchFilter ? (
        <BranchFilter filters={filters} disabled={disabled} />
      ) : null}
      {showCategoryFilter ? (
        <CategoryFilter filters={filters} disabled={disabled} />
      ) : null}
    </div>
  );
}
