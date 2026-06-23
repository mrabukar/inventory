"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import { getAuthClientErrorMessage } from "@/lib/auth/auth-error";
import { clearClientSession } from "@/lib/auth/query-cache";
import { useAppStore } from "@/store/app";

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  const clearUser = useAppStore((s) => s.clearUser);

  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: ChangePasswordInput) => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        throw new Error(
          getAuthClientErrorMessage(
            result.error,
            "Failed to change password.",
          ),
        );
      }

      clearUser();
      clearClientSession(queryClient);
      await authClient.signOut();

      return result.data;
    },
  });
}
