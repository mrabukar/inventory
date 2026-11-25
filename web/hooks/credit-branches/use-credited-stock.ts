"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listCreditedStock } from "@/service/credit-branches/credit-branches";
import type { CreditedStockQuery } from "@/types/credit-branches/credit-branch";

export function useCreditedStock(
  params: CreditedStockQuery,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["credited-stock", params],
    queryFn: () => listCreditedStock(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}
