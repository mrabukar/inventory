"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPurchase } from "@/service/purchases/create-purchase";
import { invalidateReportQueries } from "@/lib/reports/invalidate-report-queries";
import { productPurchasesQueryKey } from "./use-product-purchases";

export function useCreatePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPurchase,
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
