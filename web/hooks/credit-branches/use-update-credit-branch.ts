"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCreditBranch } from "@/service/credit-branches/credit-branches";
import type { UpdateCreditBranchInput } from "@/types/credit-branches/credit-branch";
import { creditBranchQueryKey } from "./use-credit-branch";
import { creditBranchesQueryKey } from "./use-credit-branches";

export function useUpdateCreditBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateCreditBranchInput;
    }) => updateCreditBranch(id, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: creditBranchesQueryKey });
      queryClient.invalidateQueries({ queryKey: creditBranchQueryKey(id) });
      // Invoices print the branch's details, so refresh any open ones.
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
