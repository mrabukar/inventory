"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import { clearClientSession } from "@/lib/auth/query-cache";
import { useAppStore } from "@/store/app";

export function useSignOut() {
  const queryClient = useQueryClient();
  const clearUser = useAppStore((s) => s.clearUser);

  return useMutation({
    onMutate: () => {
      clearUser();
      clearClientSession(queryClient);
    },
    mutationFn: async () => {
      const result = await authClient.signOut();

      if (result.error) {
        throw new Error(result.error.message ?? "Sign out failed");
      }
    },
    onSettled: () => {
      clearClientSession(queryClient);
    },
  });
}
