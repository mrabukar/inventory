"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateExpenseCategory } from "@/service/expense-categories/update-expense-category";
import { expenseCategoriesQueryKey } from "./use-expense-categories";
import type { UpdateExpenseCategoryInput } from "@/types/expenses/expense-category";

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateExpenseCategoryInput;
    }) => updateExpenseCategory(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseCategoriesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}
