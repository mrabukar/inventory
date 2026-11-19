"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCreditBranch } from "@/service/credit-branches/credit-branches";
import { creditBranchesQueryKey } from "./use-credit-branches";
import type { CreateCreditBranchInput } from "@/types/credit-branches/credit-branch";

export function useCreateCreditBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCreditBranchInput) => createCreditBranch(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creditBranchesQueryKey });
    },
  });
}
