import { apiFetch } from "@/service/client";
import type { Expense, UpdateExpenseInput } from "@/types/expenses/expense";

export function updateExpense(
  id: string,
  input: UpdateExpenseInput,
): Promise<Expense> {
  return apiFetch<Expense>(`/api/expenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
