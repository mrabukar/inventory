"use client";

import { useQuery } from "@tanstack/react-query";
import { listSales } from "@/service/sales/list-sales";
import type { SaleListQuery } from "@/types/sales/sale";

export const salesQueryKey = (params: SaleListQuery = {}) =>
  ["sales", params] as const;

export function useSales(params: SaleListQuery = {}) {
  return useQuery({
    queryKey: salesQueryKey(params),
    queryFn: () => listSales(params),
  });
}
