import type { AppUser } from "@/lib/types";
import type { ApiUser } from "@/types/auth/me";

export function mapApiUserToAppUser(apiUser: ApiUser): AppUser {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role === "branch_manager" ? "manager" : "admin",
    storeId: apiUser.storeId,
    store: apiUser.store?.name ?? null,
  };
}
