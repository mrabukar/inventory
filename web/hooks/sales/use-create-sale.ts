"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSale } from "@/service/sales/create-sale";
import { managerDashboardQueryKey } from "@/hooks/reports/manager-dashboard";
import type { CreateSaleInput } from "@/types/sales/create-sale";

export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSaleInput) => createSale(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: managerDashboardQueryKey() });
    },
  });
}
