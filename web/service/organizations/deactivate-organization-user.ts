import { apiFetch } from "@/service/client";

export function deactivateOrganizationUser(
  organizationId: string,
  userId: string,
): Promise<void> {
  return apiFetch<void>(
    `/api/organizations/${organizationId}/users/${userId}/deactivate`,
    { method: "PATCH" },
  );
}
