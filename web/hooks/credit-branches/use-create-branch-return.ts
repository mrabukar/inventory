"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBranchReturn } from "@/service/credit-branches/credit-branches";
import { creditBranchesQueryKey } from "./use-credit-branches";
import { branchStatementQueryKey, creditBranchQueryKey } from "./use-credit-branch";
import { branchCreditsQueryKey } from "./use-branch-credits";
import type { CreateBranchReturnInput } from "@/types/credit-branches/credit-branch";

export function useCreateBranchReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateBranchReturnInput }) =>
      createBranchReturn(id, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: creditBranchesQueryKey });
      queryClient.invalidateQueries({ queryKey: creditBranchQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: branchStatementQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: branchCreditsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
