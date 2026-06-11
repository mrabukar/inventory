import { apiFetch } from "@/service/client";

export function deleteExpenseCategory(id: number): Promise<void> {
  return apiFetch<void>(`/api/expense-categories/${id}`, { method: "DELETE" });
}
