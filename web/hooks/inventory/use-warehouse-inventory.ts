"use client";

import { useQuery } from "@tanstack/react-query";
import { listWarehouseInventory } from "@/service/inventory/list-warehouse-inventory";
import type { InventoryListQuery } from "@/types/inventory/inventory";

export const warehouseInventoryQueryKey = (params: InventoryListQuery = {}) =>
  ["warehouse-inventory", params] as const;

export function useWarehouseInventory(params: InventoryListQuery = {}) {
  return useQuery({
    queryKey: warehouseInventoryQueryKey(params),
    queryFn: () => listWarehouseInventory(params),
  });
}
