import { apiFetch } from "@/service/client";

export interface Store {
  id: string;
  name: string;
}

export function getStore(storeId: string): Promise<Store> {
  return apiFetch<Store>(`/api/stores/${storeId}`);
}
