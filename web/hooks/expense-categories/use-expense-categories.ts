"use client";

import { useQuery } from "@tanstack/react-query";
import { listExpenseCategories } from "@/service/expense-categories/list-expense-categories";

export const expenseCategoriesQueryKey = ["expense-categories"] as const;

export function useExpenseCategories() {
  return useQuery({
    queryKey: expenseCategoriesQueryKey,
    queryFn: listExpenseCategories,
  });
}
