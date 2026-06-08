"use client";

import type { ReportFilters } from "@/hooks/filters/use-report-filters";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface DateRangeFilterProps {
  filters: ReportFilters;
}

export function DateRangeFilter({ filters }: DateRangeFilterProps) {
  return (
    <DateRangePicker
      fromDate={filters.query.fromDate}
      toDate={filters.query.toDate}
      onChange={(range) =>
        filters.setDateRange(range.fromDate, range.toDate)
      }
    />
  );
}
