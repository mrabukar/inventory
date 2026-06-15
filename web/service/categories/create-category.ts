import { apiFetch } from "@/service/client";
import type { CreateCategoryInput } from "@/types/categories/create-category";
import type { Category } from "@/types/categories/category";

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  return apiFetch<Category>("/api/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
