"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface DateRangeFilterProps {
  filters: ReportFilters;
  disabled?: boolean;
}

export function DateRangeFilter({ filters, disabled = false }: DateRangeFilterProps) {
  return (
    <DateRangePicker
      fromDate={filters.query.fromDate}
      toDate={filters.query.toDate}
      disabled={disabled}
      onChange={(range) =>
        filters.setDateRange(range.fromDate, range.toDate)
      }
    />
  );
}
