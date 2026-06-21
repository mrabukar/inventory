"use client";

import { useQuery } from "@tanstack/react-query";
import { listPurchases } from "@/service/purchases/list-purchases";
import type { PurchaseListQuery } from "@/types/purchases/purchase";

export const purchasesQueryKey = (params: PurchaseListQuery = {}) =>
  ["purchases", params] as const;

export function usePurchases(params: PurchaseListQuery = {}) {
  return useQuery({
    queryKey: purchasesQueryKey(params),
    queryFn: () => listPurchases(params),
  });
}
