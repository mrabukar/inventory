"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { useAppStore } from "@/store/app";
import { authClient } from "./client";
import { mapApiUserToAppUser } from "./map-user";
import type { MeResponse } from "./types";

export const SESSION_QUERY_KEY = ["session"] as const;

async function fetchCurrentUser() {
  const { user } = await apiFetch<MeResponse>("/api/me");
  return mapApiUserToAppUser(user);
}

export function useSession() {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentUser,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
    staleTime: 30_000,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    error: query.error,
  };
}

export function useSignIn() {
  const queryClient = useQueryClient();
  const setUser = useAppStore((s) => s.setUser);

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await authClient.signIn.email({ email, password });

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
