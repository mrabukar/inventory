import { apiFetch } from "@/service/client";
import type { User } from "@/types/users/user";

export function activateOrganizationUser(
  organizationId: string,
  userId: string,
): Promise<User> {
  return apiFetch<User>(
    `/api/organizations/${organizationId}/users/${userId}/activate`,
    { method: "PATCH" },
  );
}
