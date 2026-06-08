"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import { useAppStore } from "@/store/app";
import { SESSION_QUERY_KEY } from "./session";

export function useSignOut() {
  const queryClient = useQueryClient();
  const clearUser = useAppStore((s) => s.clearUser);

  return useMutation({
    mutationFn: async () => {
      await authClient.signOut();
      clearUser();
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}
