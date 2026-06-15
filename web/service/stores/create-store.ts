import { apiFetch } from "@/service/client";
import type { CreateStoreInput } from "@/types/stores/create-store";
import type { Store } from "@/types/stores/store";

export function createStore(input: CreateStoreInput): Promise<Store> {
  return apiFetch<Store>("/api/stores", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
