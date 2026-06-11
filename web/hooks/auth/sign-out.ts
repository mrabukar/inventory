"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import { useAppStore } from "@/store/app";
import { SESSION_QUERY_KEY } from "./session";

/** Clear client session without triggering a /me refetch. */
export function clearClientSession(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.cancelQueries({ queryKey: SESSION_QUERY_KEY });
  queryClient.setQueryData(SESSION_QUERY_KEY, null);
}

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
