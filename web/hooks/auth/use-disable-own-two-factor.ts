"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "@/hooks/auth/session";
import { disableOwnTwoFactor } from "@/service/auth/disable-own-two-factor";

export function useDisableOwnTwoFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disableOwnTwoFactor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
