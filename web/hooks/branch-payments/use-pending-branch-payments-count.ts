"use client";

import { useQuery } from "@tanstack/react-query";
import { getPendingBranchPaymentsCount } from "@/service/branch-payments/branch-payments";

export const pendingBranchPaymentsCountQueryKey = [
  "branch-payments",
  "pending-count",
] as const;

export function usePendingBranchPaymentsCount(enabled: boolean) {
  return useQuery({
    queryKey: pendingBranchPaymentsCountQueryKey,
    queryFn: getPendingBranchPaymentsCount,
    enabled,
    refetchInterval: 60_000,
    select: (data) => data.count,
  });
}

/** Count and total amount of payments waiting for review (same cached query). */
export function usePendingBranchPaymentsSummary(enabled: boolean) {
  return useQuery({
    queryKey: pendingBranchPaymentsCountQueryKey,
    queryFn: getPendingBranchPaymentsCount,
    enabled,
    refetchInterval: 60_000,
  });
}
