"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useBranchScoped,
  useViewBranchId,
} from "@/hooks/branch-view/use-branch-view";
import { createPayment, listPayments } from "@/service/payments/payments";
import {
  getCustomerBalance,
  getCustomerStatement,
  getReceivables,
} from "@/service/customers/billing";
import type {
  CreatePaymentInput,
  PaymentListQuery,
} from "@/types/payments/payment";

export function usePayments(rawParams: PaymentListQuery = {}) {
  const params = useBranchScoped(rawParams);
  return useQuery({
    queryKey: ["payments", params],
    queryFn: () => listPayments(params),
  });
}

export function useCustomerBalance(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer-balance", customerId],
    queryFn: () => getCustomerBalance(customerId!),
    enabled: Boolean(customerId),
  });
}

export function useCustomerStatement(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer-statement", customerId],
    queryFn: () => getCustomerStatement(customerId!),
    enabled: Boolean(customerId),
  });
}

export function useReceivables(enabled = true) {
  const storeId = useViewBranchId();
  return useQuery({
    queryKey: ["receivables", storeId ?? null],
    queryFn: () => getReceivables(storeId),
    enabled,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => createPayment(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-balance", result.customerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["customer-statement", result.customerId],
      });
    },
  });
}
