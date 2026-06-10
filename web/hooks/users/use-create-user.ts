"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser } from "@/service/users/create-user";
import type { CreateUserInput } from "@/types/users/user";

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
