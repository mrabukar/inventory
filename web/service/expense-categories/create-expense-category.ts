import { apiFetch } from "@/service/client";
import type {
  CreateExpenseCategoryInput,
  ExpenseCategory,
} from "@/types/expenses/expense-category";

export function createExpenseCategory(
  input: CreateExpenseCategoryInput,
): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>("/api/expense-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
