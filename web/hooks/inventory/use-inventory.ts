"use client";

import { useQuery } from "@tanstack/react-query";
import { listInventory } from "@/service/inventory/list-inventory";
import type {
  InventoryListQuery,
  InventoryListScope,
} from "@/types/inventory/inventory";

export const inventoryQueryKey = (
  scope: InventoryListScope,
  params: InventoryListQuery = {},
) => ["inventory", scope, params] as const;

export function useInventory(
  params: InventoryListQuery = {},
  scope: InventoryListScope = "all",
) {
  return useQuery({
    queryKey: inventoryQueryKey(scope, params),
    queryFn: () => listInventory(params, scope),
  });
}
