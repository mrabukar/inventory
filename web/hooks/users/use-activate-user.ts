"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { activateUser } from "@/service/users/activate-user";

export function useActivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
