import { apiFetch } from "@/service/client";
import type { Inventory } from "@/types/inventory/inventory";

export interface WarehouseStockWriteOffInput {
  productId: string;
  quantity: number;
  note: string;
}

export function writeOffWarehouseStock(
  input: WarehouseStockWriteOffInput,
): Promise<Inventory> {
  return apiFetch<Inventory>("/api/inventory/warehouse/write-off", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
