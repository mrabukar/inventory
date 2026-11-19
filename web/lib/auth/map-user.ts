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
    phone: apiUser.phone ?? null,
    role,
    twoFactorEnabled: apiUser.twoFactorEnabled ?? false,
    twoFactorRequired: apiUser.twoFactorRequired ?? true,
    storeId: apiUser.storeId,
    store: apiUser.store?.name ?? null,
    isCreditBranch: apiUser.store?.type === "credit",
    organizationId: apiUser.organization?.id ?? apiUser.organizationId ?? null,
    organizationName: apiUser.organization?.name ?? null,
    hasStores: apiUser.organization?.hasStores ?? null,
    billingEnabled: apiUser.organization?.billingEnabled ?? null,
    organizationLogoKey: apiUser.organization?.logoKey ?? null,
    organizationLogoUpdatedAt: apiUser.organization?.logoUpdatedAt ?? null,
  };
}
