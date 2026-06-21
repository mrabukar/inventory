import { apiFetch } from "@/service/client";
import type { Store } from "@/types/stores/store";

export function getWarehouseStore(): Promise<Store> {
  return apiFetch<Store>("/api/stores/warehouse");
}
