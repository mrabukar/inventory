"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrganizationUser } from "@/service/organizations/update-organization-user";
import type { UpdateOrganizationUserInput } from "@/types/organizations/organization";

export function useUpdateOrganizationUser(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string;
      input: UpdateOrganizationUserInput;
    }) => updateOrganizationUser(organizationId, userId, input),
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
