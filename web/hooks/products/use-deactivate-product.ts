"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deactivateProduct } from "@/service/products/deactivate-product";
import type { DeactivateProductInput } from "@/types/products/deactivate-product";

export function useDeactivateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input = {},
    }: {
      id: string;
      input?: DeactivateProductInput;
    }) => deactivateProduct(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
