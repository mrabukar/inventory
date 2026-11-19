"use client";

import { useQuery } from "@tanstack/react-query";
import { listCreditBranches } from "@/service/credit-branches/credit-branches";

export const creditBranchesQueryKey = ["credit-branches"] as const;

export function useCreditBranches() {
  return useQuery({
    queryKey: creditBranchesQueryKey,
    queryFn: listCreditBranches,
  });
}
