"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/service/client";
import { getMe } from "@/service/auth/me";
import { mapApiUserToAppUser } from "@/lib/auth/map-user";

export const SESSION_QUERY_KEY = ["session"] as const;

export async function fetchCurrentUser() {
  const { user } = await getMe();
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
    refetchOnMount: (query) => query.state.data !== null,
  });

  const user = query.isSuccess && query.data ? query.data : null;

  return {
    user,
    isLoading: query.isPending,
    isFetched: query.isFetched,
    isAuthenticated: query.isSuccess && !!query.data,
    error: query.error,
  };
}
