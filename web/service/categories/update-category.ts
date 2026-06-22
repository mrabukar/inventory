import { apiFetch } from "@/service/client";
import type { UpdateCategoryInput } from "@/types/categories/update-category";
import type { Category } from "@/types/categories/category";

export function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  return apiFetch<Category>(`/api/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
