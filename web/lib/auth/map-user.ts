import type { AppUser, Role } from "@/lib/types";
import type { ApiUser } from "@/types/auth/me";

export function mapApiUserToAppUser(apiUser: ApiUser): AppUser {
  const role: Role =
    apiUser.role === "branch_manager"
      ? "manager"
      : apiUser.role === "super_admin"
        ? "super_admin"
        : "admin";

  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role,
    storeId: apiUser.storeId,
    store: apiUser.store?.name ?? null,
    organizationId: apiUser.organization?.id ?? apiUser.organizationId ?? null,
    organizationName: apiUser.organization?.name ?? null,
    hasStores: apiUser.organization?.hasStores ?? null,
  };
}
