import { apiFetch } from "@/service/client";
import type { Store } from "@/types/stores/store";

export function reactivateStore(id: string): Promise<Store> {
  return apiFetch<Store>(`/api/stores/${id}/reactivate`, { method: "PATCH" });
}
