import { apiFetch } from "@/service/client";
import type { Category } from "@/types/categories/category";

export function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/api/categories");
}
