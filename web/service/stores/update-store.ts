import { apiFetch } from "@/service/client";
import type { UpdateStoreInput } from "@/types/stores/update-store";
import type { Store } from "@/types/stores/store";

export function updateStore(id: string, input: UpdateStoreInput): Promise<Store> {
  return apiFetch<Store>(`/api/stores/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
