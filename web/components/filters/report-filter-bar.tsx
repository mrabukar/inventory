"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { CategoryFilter } from "./category-filter";
import { DateRangeFilter } from "./date-range-filter";
import { StoreFilter } from "./store-filter";

interface ReportFilterBarProps {
  filters: ReportFilters;
  showCategoryFilter?: boolean;
}

export function ReportFilterBar({
  filters,
  showCategoryFilter = false,
}: ReportFilterBarProps) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <DateRangeFilter filters={filters} />
      <StoreFilter filters={filters} />
      {showCategoryFilter ? <CategoryFilter filters={filters} /> : null}
    </div>
  );
}
