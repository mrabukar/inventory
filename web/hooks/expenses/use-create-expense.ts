"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpense } from "@/service/expenses/create-expense";
import type { CreateExpenseInput } from "@/types/expenses/expense";

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) => createExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
