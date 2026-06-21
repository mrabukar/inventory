"use client";

import { useQuery } from "@tanstack/react-query";
import { getWarehouseStore } from "@/service/stores/get-warehouse";

export const warehouseStoreQueryKey = ["warehouse-store"] as const;

export function useWarehouseStore() {
  return useQuery({
    queryKey: warehouseStoreQueryKey,
    queryFn: getWarehouseStore,
  });
}
