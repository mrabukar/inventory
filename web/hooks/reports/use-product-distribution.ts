"use client";

import { useQuery } from "@tanstack/react-query";
import { useBranchScoped } from "@/hooks/branch-view/use-branch-view";
import { getProductDistribution } from "@/service/reports/product-distribution";
import type { ProductDistributionQuery } from "@/types/reports/product-distribution";

export const productDistributionQueryKey = (params: ProductDistributionQuery) =>
  ["reports", "product-distribution", params] as const;

export function useProductDistribution(rawParams: ProductDistributionQuery) {
  const params = useBranchScoped(rawParams);
  return useQuery({
    queryKey: productDistributionQueryKey(params),
    queryFn: () => getProductDistribution(params),
    enabled: Boolean(params.categoryId?.trim()),
  });
}
