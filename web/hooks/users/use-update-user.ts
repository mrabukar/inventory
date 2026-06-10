"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUser } from "@/service/users/update-user";
import type { UpdateUserInput } from "@/types/users/user";

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      updateUser(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
