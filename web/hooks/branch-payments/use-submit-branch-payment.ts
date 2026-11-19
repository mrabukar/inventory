"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitBranchPayment } from "@/service/branch-payments/branch-payments";
import type { SubmitBranchPaymentInput } from "@/types/credit-branches/credit-branch";

export function useSubmitBranchPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitBranchPaymentInput) => submitBranchPayment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-payments"] });
      queryClient.invalidateQueries({ queryKey: ["credit-branches"] });
    },
  });
}
