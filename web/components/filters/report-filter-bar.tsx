"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { DateRangeFilter } from "./date-range-filter";
import { StoreFilter } from "./store-filter";

interface ReportFilterBarProps {
  filters: ReportFilters;
}

export function ReportFilterBar({ filters }: ReportFilterBarProps) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <DateRangeFilter filters={filters} />
      <StoreFilter filters={filters} />
    </div>
  );
}
