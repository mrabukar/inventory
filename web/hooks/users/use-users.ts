"use client";

import { useQuery } from "@tanstack/react-query";
import { listUsers } from "@/service/users/list-users";
import type { UserListQuery } from "@/types/users/user";

export const usersQueryKey = (params: UserListQuery = {}) =>
  ["users", params] as const;

export function useUsers(params: UserListQuery = {}) {
  return useQuery({
    queryKey: usersQueryKey(params),
    queryFn: () => listUsers(params),
  });
}
