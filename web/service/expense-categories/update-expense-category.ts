import { apiFetch } from "@/service/client";
import type {
  ExpenseCategory,
  UpdateExpenseCategoryInput,
} from "@/types/expenses/expense-category";

export function updateExpenseCategory(
  id: number,
  input: UpdateExpenseCategoryInput,
): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>(`/api/expense-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
