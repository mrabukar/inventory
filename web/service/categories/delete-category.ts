import { apiFetch } from "@/service/client";

export function deleteCategory(id: string): Promise<void> {
  return apiFetch<void>(`/api/categories/${id}`, { method: "DELETE" });
}
