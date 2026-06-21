"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { writeOffWarehouseStock } from "@/service/inventory/write-off-warehouse-stock";
import type { WarehouseStockWriteOffInput } from "@/service/inventory/write-off-warehouse-stock";
import { warehouseInventoryQueryKey } from "@/hooks/inventory/use-warehouse-inventory";
import { invalidateReportQueries } from "@/lib/reports/invalidate-report-queries";

export function useWriteOffWarehouseStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: WarehouseStockWriteOffInput) =>
      writeOffWarehouseStock(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: warehouseInventoryQueryKey() });
      invalidateReportQueries(queryClient);
    },
  });
}
