"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deactivateStore } from "@/service/stores/deactivate-store";

export function useDeactivateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateStore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}
