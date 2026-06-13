"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { correctSale } from "@/service/sales/correct-sale";
import { managerDashboardQueryKey } from "@/hooks/reports/manager-dashboard";
import type { CorrectSaleInput } from "@/types/sales/create-sale";

export function useCorrectSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CorrectSaleInput }) =>
      correctSale(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: managerDashboardQueryKey() });
    },
  });
}
