"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateExpense } from "@/service/expenses/update-expense";
import type { UpdateExpenseInput } from "@/types/expenses/expense";

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) =>
      updateExpense(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
