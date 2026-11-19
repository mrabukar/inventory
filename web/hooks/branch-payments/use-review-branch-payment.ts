"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveBranchPayment,
  rejectBranchPayment,
} from "@/service/branch-payments/branch-payments";

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["branch-payments"] });
    queryClient.invalidateQueries({ queryKey: ["credit-branches"] });
  };
}

export function useApproveBranchPayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => approveBranchPayment(id),
    onSuccess: invalidate,
  });
}

export function useRejectBranchPayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectBranchPayment(id, reason),
    onSuccess: invalidate,
  });
}
