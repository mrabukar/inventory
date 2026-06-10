"use client";

import { useQuery } from "@tanstack/react-query";
import { listStockSupplies } from "@/service/stock-supplies/list-stock-supplies";
import type { StockSupplyListQuery } from "@/types/stock-supplies/stock-supply";

export const stockSuppliesQueryKey = (params: StockSupplyListQuery = {}) =>
  ["stock-supplies", params] as const;

export function useStockSupplies(params: StockSupplyListQuery = {}) {
  return useQuery({
    queryKey: stockSuppliesQueryKey(params),
    queryFn: () => listStockSupplies(params),
  });
}
