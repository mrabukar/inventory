"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listBranchPayments,
  type BranchPaymentListQuery,
} from "@/service/branch-payments/branch-payments";

export const branchPaymentsQueryKey = (params: BranchPaymentListQuery = {}) =>
  ["branch-payments", params] as const;

export function useBranchPayments(params: BranchPaymentListQuery = {}) {
  return useQuery({
    queryKey: branchPaymentsQueryKey(params),
    queryFn: () => listBranchPayments(params),
    // Keep the old rows while the next page loads, but not when the tab or
    // sort changes (they'd belong to a different list).
    placeholderData: (previous, previousQuery) => {
      const prev = previousQuery?.queryKey[1] as
        | BranchPaymentListQuery
        | undefined;
      const sameList =
        prev?.status === params.status &&
        prev?.storeId === params.storeId &&
        prev?.sortBy === params.sortBy &&
        prev?.order === params.order;
      return sameList ? previous : undefined;
    },
  });
}
