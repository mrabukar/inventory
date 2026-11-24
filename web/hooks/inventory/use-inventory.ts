"use client";

import { useQuery } from "@tanstack/react-query";
import { useBranchScoped } from "@/hooks/branch-view/use-branch-view";
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
  rawParams: InventoryListQuery = {},
  scope: InventoryListScope = "all",
) {
  const params = useBranchScoped(rawParams);
  return useQuery({
    queryKey: inventoryQueryKey(scope, params),
    queryFn: () => listInventory(params, scope),
  });
}
