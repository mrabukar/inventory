import { apiFetch } from "@/service/client";
import type { User } from "@/types/users/user";
import type { UpdateOrganizationUserInput } from "@/types/organizations/organization";

export function updateOrganizationUser(
  organizationId: string,
  userId: string,
  input: UpdateOrganizationUserInput,
): Promise<User> {
  return apiFetch<User>(`/api/organizations/${organizationId}/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
