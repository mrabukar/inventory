"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reactivateStore } from "@/service/stores/reactivate-store";

export function useReactivateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reactivateStore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}
