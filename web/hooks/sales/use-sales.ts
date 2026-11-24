"use client";

import { useQuery } from "@tanstack/react-query";
import { useBranchScoped } from "@/hooks/branch-view/use-branch-view";
import { listSales } from "@/service/sales/list-sales";
import type { SaleListQuery } from "@/types/sales/sale";

export const salesQueryKey = (params: SaleListQuery = {}) =>
  ["sales", params] as const;

export function useSales(rawParams: SaleListQuery = {}) {
  const params = useBranchScoped(rawParams);
  return useQuery({
    queryKey: salesQueryKey(params),
    queryFn: () => listSales(params),
  });
}
