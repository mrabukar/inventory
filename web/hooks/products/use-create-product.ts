"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProduct } from "@/service/products/create-product";
import type { CreateProductInput } from "@/types/products/create-product";

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
