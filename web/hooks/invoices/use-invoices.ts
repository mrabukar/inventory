"use client";

import { useQuery } from "@tanstack/react-query";
import { useBranchScoped } from "@/hooks/branch-view/use-branch-view";
import { getInvoice, listInvoices } from "@/service/invoices/invoices";
import type { InvoiceListQuery } from "@/types/invoices/invoice";

export function useInvoices(
  rawParams: InvoiceListQuery = {},
  options: { enabled?: boolean } = {},
) {
  const params = useBranchScoped(rawParams);
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => listInvoices(params),
    enabled: options.enabled ?? true,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => getInvoice(id!),
    enabled: Boolean(id),
  });
}
