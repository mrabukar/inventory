"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetUserTwoFactor } from "@/service/users/reset-two-factor";

export function useResetTwoFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => resetUserTwoFactor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
