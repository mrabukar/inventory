"use client";

import { useCallback, useMemo, useState } from "react";
import {
  formatPeriodLabel,
  getCurrentMonthRange,
  getLastMonthRange,
  getLastSixMonthsRange,
  isSameRange,
} from "@/lib/filters/dates";
import type { ReportQuery } from "@/types/reports/query";

export type DateRangePreset = "this-month" | "last-month" | "last-6-months";

export interface ReportFilters {
  query: ReportQuery;
  dateLabel: string;
  activePreset: DateRangePreset | "custom";
  setDateRange: (fromDate: string, toDate: string) => void;
  setPreset: (preset: DateRangePreset) => void;
  setStoreId: (storeId: string | undefined) => void;
  setCategoryId: (categoryId: string | undefined) => void;
}

export function useReportFilters(
  initialQuery: ReportQuery = getCurrentMonthRange(),
): ReportFilters {
  const [query, setQuery] = useState<ReportQuery>(() => initialQuery);

  const activePreset = useMemo((): ReportFilters["activePreset"] => {
    if (isSameRange(query, getCurrentMonthRange())) return "this-month";
    if (isSameRange(query, getLastMonthRange())) return "last-month";
    if (isSameRange(query, getLastSixMonthsRange())) return "last-6-months";
    return "custom";
  }, [query]);

  const setDateRange = useCallback((fromDate: string, toDate: string) => {
    setQuery((prev) => ({ ...prev, fromDate, toDate }));
  }, []);

  const setPreset = useCallback((preset: DateRangePreset) => {
    const range =
      preset === "this-month"
        ? getCurrentMonthRange()
        : preset === "last-month"
          ? getLastMonthRange()
          : getLastSixMonthsRange();
    setQuery((prev) => ({
      ...prev,
      fromDate: range.fromDate,
      toDate: range.toDate,
    }));
  }, []);

  const setStoreId = useCallback((storeId: string | undefined) => {
    setQuery((prev) => {
      const next = { ...prev };
      if (storeId) {
        next.storeId = storeId;
      } else {
        delete next.storeId;
      }
      return next;
    });
  }, []);

  const setCategoryId = useCallback((categoryId: string | undefined) => {
    setQuery((prev) => {
      const next = { ...prev };
      if (categoryId != null) {
        next.categoryId = categoryId;
      } else {
        delete next.categoryId;
      }
      return next;
    });
  }, []);

  return {
    query,
    dateLabel: formatPeriodLabel(query.fromDate, query.toDate),
    activePreset,
    setDateRange,
    setPreset,
    setStoreId,
    setCategoryId,
  };
}
