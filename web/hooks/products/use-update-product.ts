"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProduct } from "@/service/products/update-product";
import type { UpdateProductInput } from "@/types/products/update-product";

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      updateProduct(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
