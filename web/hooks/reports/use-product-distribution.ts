"use client";

import { useQuery } from "@tanstack/react-query";
import { getProductDistribution } from "@/service/reports/product-distribution";
import type { ProductDistributionQuery } from "@/types/reports/product-distribution";

export const productDistributionQueryKey = (params: ProductDistributionQuery) =>
  ["reports", "product-distribution", params] as const;

export function useProductDistribution(params: ProductDistributionQuery) {
  return useQuery({
    queryKey: productDistributionQueryKey(params),
    queryFn: () => getProductDistribution(params),
    enabled: params.categoryId != null && params.categoryId > 0,
  });
}
