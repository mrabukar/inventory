"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deactivateUser } from "@/service/users/deactivate-user";

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
