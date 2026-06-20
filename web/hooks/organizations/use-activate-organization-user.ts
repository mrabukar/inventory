"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { activateOrganizationUser } from "@/service/organizations/activate-organization-user";

export function useActivateOrganizationUser(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      activateOrganizationUser(organizationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId],
      });
    },
  });
}
