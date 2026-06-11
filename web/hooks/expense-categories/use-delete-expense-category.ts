"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteExpenseCategory } from "@/service/expense-categories/delete-expense-category";
import { expenseCategoriesQueryKey } from "./use-expense-categories";

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteExpenseCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseCategoriesQueryKey });
    },
  });
}
