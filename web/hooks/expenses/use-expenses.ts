"use client";

import { useQuery } from "@tanstack/react-query";
import { listExpenses } from "@/service/expenses/list-expenses";
import type { ExpenseListQuery } from "@/types/expenses/expense";

export const expensesQueryKey = (params: ExpenseListQuery = {}) =>
  ["expenses", params] as const;

export function useExpenses(params: ExpenseListQuery = {}) {
  return useQuery({
    queryKey: expensesQueryKey(params),
    queryFn: () => listExpenses(params),
  });
}
