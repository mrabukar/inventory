import { apiFetch } from "@/service/client";
import type { CreateExpenseInput, Expense } from "@/types/expenses/expense";

export function createExpense(input: CreateExpenseInput): Promise<Expense> {
  return apiFetch<Expense>("/api/expenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
