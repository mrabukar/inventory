"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateStore } from "@/service/stores/update-store";
import type { UpdateStoreInput } from "@/types/stores/update-store";

export function useUpdateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStoreInput }) =>
      updateStore(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}
