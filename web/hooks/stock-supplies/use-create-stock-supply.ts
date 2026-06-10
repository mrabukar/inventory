"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createStockSupply } from "@/service/stock-supplies/create-stock-supply";
import type { CreateStockSupplyInput } from "@/types/stock-supplies/stock-supply";

export function useCreateStockSupply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStockSupplyInput) => createStockSupply(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-supplies"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
