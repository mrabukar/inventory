"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteCategory } from "@/service/categories/delete-category";
import { categoriesQueryKey } from "./use-categories";

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    },
  });
}
