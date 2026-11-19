"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getBranchStatement,
  getCreditBranch,
} from "@/service/credit-branches/credit-branches";
import type { BranchStatementQuery } from "@/types/credit-branches/credit-branch";

export const creditBranchQueryKey = (id: string) =>
  ["credit-branches", id] as const;

export function useCreditBranch(id: string | undefined) {
  return useQuery({
    queryKey: creditBranchQueryKey(id ?? ""),
    queryFn: () => getCreditBranch(id!),
    enabled: !!id,
  });
}

export const branchStatementQueryKey = (
  id: string,
  params?: BranchStatementQuery,
) =>
  params
    ? (["credit-branches", id, "statement", params] as const)
    : (["credit-branches", id, "statement"] as const);

export function useBranchStatement(
  id: string | undefined,
  params: BranchStatementQuery = {},
) {
  return useQuery({
    queryKey: branchStatementQueryKey(id ?? "", params),
    queryFn: () => getBranchStatement(id!, params),
    enabled: !!id,
    // Keep the old rows on screen while the next page loads, but not when the
    // order flips (they'd be the wrong way round).
    placeholderData: (previous, previousQuery) => {
      const prev = previousQuery?.queryKey[3] as
        | BranchStatementQuery
        | undefined;
      return prev?.order === params.order ? previous : undefined;
    },
  });
}
