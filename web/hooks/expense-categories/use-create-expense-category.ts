"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpenseCategory } from "@/service/expense-categories/create-expense-category";
import { expenseCategoriesQueryKey } from "./use-expense-categories";
import type { CreateExpenseCategoryInput } from "@/types/expenses/expense-category";

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseCategoryInput) =>
      createExpenseCategory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseCategoriesQueryKey });
    },
  });
}
