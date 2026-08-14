"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPurchaseBatch } from "@/service/purchases/create-purchase-batch";
import { invalidateReportQueries } from "@/lib/reports/invalidate-report-queries";

export function useCreatePurchaseBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPurchaseBatch,
    onSuccess: () => {
      // Invalidate broadly — multiple products may have changed
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      invalidateReportQueries(queryClient);
    },
  });
}
