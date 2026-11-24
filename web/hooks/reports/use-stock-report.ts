"use client";

import { useQuery } from "@tanstack/react-query";
import { useBranchScoped } from "@/hooks/branch-view/use-branch-view";
import { getStockReport } from "@/service/reports/stock-report";
import type { StockReportQuery } from "@/types/reports/stock-report";

export const stockReportQueryKey = (params: StockReportQuery) =>
  ["reports", "stock-report", params] as const;

export function useStockReport(rawParams: StockReportQuery) {
  const params = useBranchScoped(rawParams);
  return useQuery({
    queryKey: stockReportQueryKey(params),
    queryFn: () => getStockReport(params),
  });
}
