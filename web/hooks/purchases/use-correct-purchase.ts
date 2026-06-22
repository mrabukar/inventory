"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { correctPurchase } from "@/service/purchases/correct-purchase";
import { invalidateReportQueries } from "@/lib/reports/invalidate-report-queries";
import type { CorrectPurchaseInput } from "@/types/purchases/purchase";
import { productPurchasesQueryKey } from "./use-product-purchases";

export function useCorrectPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      purchaseId,
      input,
    }: {
      purchaseId: string;
      input: CorrectPurchaseInput;
    }) => correctPurchase(purchaseId, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({
        queryKey: productPurchasesQueryKey(result.productId),
      });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      invalidateReportQueries(queryClient);
    },
  });
}
