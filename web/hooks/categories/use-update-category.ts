"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCategory } from "@/service/categories/update-category";
import { categoriesQueryKey } from "./use-categories";
import type { UpdateCategoryInput } from "@/types/categories/update-category";

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      updateCategory(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    },
  });
}
