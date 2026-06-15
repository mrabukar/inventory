"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCategory } from "@/service/categories/create-category";
import { categoriesQueryKey } from "./use-categories";
import type { CreateCategoryInput } from "@/types/categories/create-category";

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    },
  });
}
