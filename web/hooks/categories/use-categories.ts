"use client";

import { useQuery } from "@tanstack/react-query";
import { listCategories } from "@/service/categories/list-categories";

export const categoriesQueryKey = ["categories"] as const;

export function useCategories() {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: listCategories,
  });
}
