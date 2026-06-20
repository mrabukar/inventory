"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import { clearTenantQueries } from "@/lib/auth/query-cache";
import { useAppStore } from "@/store/app";
import { fetchCurrentUser, SESSION_QUERY_KEY } from "./session";

export function useSignIn() {
  const queryClient = useQueryClient();
  const setUser = useAppStore((s) => s.setUser);

  return useMutation({
    onMutate: () => {
      clearTenantQueries(queryClient);
    },
    mutationFn: async ({
      email,
      password,
      rememberMe = true,
    }: {
      email: string;
      password: string;
      rememberMe?: boolean;
    }) => {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe,
      });

      if (result.error) {
        const message =
          result.error.message?.trim() ||
          result.error.statusText?.trim() ||
          "Sign in failed.";
        throw new Error(message);
      }

      const user = await fetchCurrentUser();
      setUser(user);
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      return user;
    },
  });
}
