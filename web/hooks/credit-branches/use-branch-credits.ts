"use client";

import { useQuery } from "@tanstack/react-query";
import { listBranchCredits } from "@/service/credit-branches/credit-branches";

export const branchCreditsQueryKey = (id: string) =>
  ["credit-branches", id, "credits"] as const;

export function useBranchCredits(id: string | undefined) {
  return useQuery({
    queryKey: branchCreditsQueryKey(id ?? ""),
    queryFn: () => listBranchCredits(id!),
    enabled: !!id,
  });
}
