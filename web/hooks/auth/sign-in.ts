"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import { useAppStore } from "@/store/app";
import { fetchCurrentUser, SESSION_QUERY_KEY } from "./session";

export function useSignIn() {
  const queryClient = useQueryClient();
  const setUser = useAppStore((s) => s.setUser);

  return useMutation({
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
        throw new Error(result.error.message ?? "Invalid email or password.");
      }

      const user = await fetchCurrentUser();
      setUser(user);
      await queryClient.setQueryData(SESSION_QUERY_KEY, user);
      return user;
    },
  });
}
