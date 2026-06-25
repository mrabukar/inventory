"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  correctPurchaseAdd,
  correctPurchaseSubtract,
} from "@/service/purchases/correct-purchase";
import { invalidateReportQueries } from "@/lib/reports/invalidate-report-queries";
import type { CorrectPurchaseInput } from "@/types/purchases/purchase";
import { productPurchasesQueryKey } from "./use-product-purchases";

function usePurchaseCorrectionMutation(
  mutationFn: (
    args: { purchaseId: string; input: CorrectPurchaseInput },
  ) => ReturnType<typeof correctPurchaseAdd>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
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

export function useCorrectPurchaseAdd() {
  return usePurchaseCorrectionMutation(({ purchaseId, input }) =>
    correctPurchaseAdd(purchaseId, input),
  );
}

export function useCorrectPurchaseSubtract() {
  return usePurchaseCorrectionMutation(({ purchaseId, input }) =>
    correctPurchaseSubtract(purchaseId, input),
  );
}

/** @deprecated Use useCorrectPurchaseSubtract */
export function useCorrectPurchase() {
  return useCorrectPurchaseSubtract();
}
