"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { manageUserTwoFactor } from "@/service/users/manage-two-factor";
import type { TwoFactorAction } from "@/types/users/user";

export function useManageTwoFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: TwoFactorAction }) =>
      manageUserTwoFactor(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
