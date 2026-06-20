"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deactivateOrganizationUser } from "@/service/organizations/deactivate-organization-user";

export function useDeactivateOrganizationUser(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      deactivateOrganizationUser(organizationId, userId),
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
