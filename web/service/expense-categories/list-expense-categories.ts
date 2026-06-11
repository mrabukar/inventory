import { apiFetch } from "@/service/client";
import type { ExpenseCategory } from "@/types/expenses/expense-category";

export function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return apiFetch<ExpenseCategory[]>("/api/expense-categories");
}
