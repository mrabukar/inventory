"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser } from "@/service/users/create-user";
import { useAppStore } from "@/store/app";
import type { CreateUserInput } from "@/types/users/user";

export function useCreateUser(organizationIdOverride?: string | null) {
  const queryClient = useQueryClient();
  const organizationId = useAppStore((s) => s.user?.organizationId);

  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      createUser(input, organizationIdOverride ?? organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
