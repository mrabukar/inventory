"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createStore } from "@/service/stores/create-store";
import type { CreateStoreInput } from "@/types/stores/create-store";

export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStoreInput) => createStore(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}
