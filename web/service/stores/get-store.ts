import { apiFetch } from "@/service/client";
import type { Store } from "@/types/stores/store";

export function getStore(storeId: string): Promise<Store> {
  return apiFetch<Store>(`/api/stores/${storeId}`);
}
