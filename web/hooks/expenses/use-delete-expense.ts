"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteExpense } from "@/service/expenses/delete-expense";

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
