"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { BranchScopeSelect } from "./branch-scope-select";
import { CategoryFilter } from "./category-filter";
import { DateRangeFilter } from "./date-range-filter";
import { StoreFilter } from "./store-filter";

interface ReportFilterBarProps {
  filters: ReportFilters;
  showCategoryFilter?: boolean;
  showStoreFilter?: boolean;
  /** Fonex / All branches / a branch, for a credit organization's admin. */
  showBranchScope?: boolean;
  disabled?: boolean;
}

export function ReportFilterBar({
  filters,
  showCategoryFilter = false,
  showStoreFilter = true,
  showBranchScope = false,
  disabled = false,
}: ReportFilterBarProps) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <DateRangeFilter filters={filters} disabled={disabled} />
      {showBranchScope ? <BranchScopeSelect disabled={disabled} /> : null}
      {showStoreFilter ? (
        <StoreFilter filters={filters} disabled={disabled} />
      ) : null}
      {showCategoryFilter ? (
        <CategoryFilter filters={filters} disabled={disabled} />
      ) : null}
    </div>
  );
}
