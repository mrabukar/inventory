import type { AppUser, Role } from "@/lib/types";
import type { ApiUser } from "@/types/auth/me";

export function mapApiUserToAppUser(apiUser: ApiUser): AppUser {
  // An unknown role gets the least access, never admin's.
  const role: Role =
    apiUser.role === "branch_manager"
      ? "manager"
      : apiUser.role === "super_admin"
        ? "super_admin"
        : apiUser.role === "admin"
          ? "admin"
          : "limited";

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
    allowedPages: apiUser.allowedPages ?? [],
    usesCreditBranches: apiUser.organization?.usesCreditBranches ?? null,
    billingEnabled: apiUser.organization?.billingEnabled ?? null,
    organizationLogoKey: apiUser.organization?.logoKey ?? null,
    organizationLogoUpdatedAt: apiUser.organization?.logoUpdatedAt ?? null,
  };
}
