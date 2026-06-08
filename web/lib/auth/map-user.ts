import { getStore } from "@/service/stores/get-store";
import type { AppUser } from "@/lib/types";
import type { ApiUser } from "@/types/auth/me";

export async function mapApiUserToAppUser(apiUser: ApiUser): Promise<AppUser> {
  let storeName: string | null = null;

  if (apiUser.role === "branch_manager" && apiUser.storeId) {
    try {
      const store = await getStore(apiUser.storeId);
      storeName = store.name;
    } catch {
      storeName = null;
    }
  }

  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role === "branch_manager" ? "manager" : "admin",
    storeId: apiUser.storeId,
    store: storeName,
  };
}
