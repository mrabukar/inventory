"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setOpeningCost } from "@/service/products/set-opening-cost";
import type { SetOpeningCostInput } from "@/service/products/set-opening-cost";
import { invalidateReportQueries } from "@/lib/reports/invalidate-report-queries";
import { productPurchasesQueryKey } from "@/hooks/purchases/use-product-purchases";

export function useSetOpeningCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      input,
    }: {
      productId: string;
      input: SetOpeningCostInput;
    }) => setOpeningCost(productId, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({
        queryKey: productPurchasesQueryKey(result.productId),
      });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-inventory"] });
      invalidateReportQueries(queryClient);
    },
  });
}
