import { apiFetch } from "@/service/client";

export function deleteExpense(id: string): Promise<void> {
  return apiFetch<void>(`/api/expenses/${id}`, { method: "DELETE" });
}
