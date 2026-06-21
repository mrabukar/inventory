"use client";

import { useQuery } from "@tanstack/react-query";
import { listProductPurchases } from "@/service/purchases/list-purchases";
import type { PurchaseListQuery } from "@/types/purchases/purchase";

export const productPurchasesQueryKey = (
  productId: string,
  params: PurchaseListQuery = {},
) => ["product-purchases", productId, params] as const;

export function useProductPurchases(
  productId: string | undefined,
  params: PurchaseListQuery = {},
) {
  return useQuery({
    queryKey: productPurchasesQueryKey(productId ?? "", params),
    queryFn: () => listProductPurchases(productId!, params),
    enabled: Boolean(productId),
  });
}
