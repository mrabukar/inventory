"use client";

import { useQuery } from "@tanstack/react-query";
import { getStockReport } from "@/service/reports/stock-report";
import type { StockReportQuery } from "@/types/reports/stock-report";

export const stockReportQueryKey = (params: StockReportQuery) =>
  ["reports", "stock-report", params] as const;

export function useStockReport(params: StockReportQuery) {
  return useQuery({
    queryKey: stockReportQueryKey(params),
    queryFn: () => getStockReport(params),
  });
}
