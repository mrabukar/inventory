"use client";

import { useQuery } from "@tanstack/react-query";
import { getInvoice, listInvoices } from "@/service/invoices/invoices";
import type { InvoiceListQuery } from "@/types/invoices/invoice";

export function useInvoices(
  params: InvoiceListQuery = {},
  options: { enabled?: boolean } = {},
) {
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
