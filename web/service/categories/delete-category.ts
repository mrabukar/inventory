import { apiFetch } from "@/service/client";

export function deleteCategory(id: number): Promise<void> {
  return apiFetch<void>(`/api/categories/${id}`, { method: "DELETE" });
}
