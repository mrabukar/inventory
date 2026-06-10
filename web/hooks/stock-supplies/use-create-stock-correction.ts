"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createStockCorrectionAdd,
  createStockCorrectionSubtract,
} from "@/service/stock-supplies/create-stock-correction";
import type { CreateStockCorrectionInput } from "@/types/stock-supplies/stock-supply";

export function useCreateStockCorrectionAdd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStockCorrectionInput) =>
      createStockCorrectionAdd(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-supplies"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useCreateStockCorrectionSubtract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStockCorrectionInput) =>
      createStockCorrectionSubtract(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-supplies"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
