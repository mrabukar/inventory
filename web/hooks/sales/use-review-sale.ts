"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveSale,
  getPendingSalesCount,
  rejectSale,
} from "@/service/sales/review-sale";

export const pendingSalesCountQueryKey = ["sales", "pending-count"] as const;

export function usePendingSalesCount(enabled: boolean) {
  return useQuery({
    queryKey: pendingSalesCountQueryKey,
    queryFn: getPendingSalesCount,
    enabled,
    refetchInterval: 60_000,
    select: (data) => data.count,
  });
}

/**
 * Approving or rejecting changes revenue, stock, invoices and dashboards, so
 * refresh everything currently on screen rather than guessing which keys.
 */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useApproveSale() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => approveSale(id),
    onSuccess: invalidate,
  });
}

export function useRejectSale() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectSale(id, reason),
    onSuccess: invalidate,
  });
}
