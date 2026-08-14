import { apiFetch } from "@/service/client";
import type {
  Invoice,
  InvoiceListQuery,
  InvoiceListResponse,
} from "@/types/invoices/invoice";

function toQueryString(params: InvoiceListQuery = {}): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.status) search.set("status", params.status);
  if (params.customerId) search.set("customerId", params.customerId);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listInvoices(
  params: InvoiceListQuery = {},
): Promise<InvoiceListResponse> {
  return apiFetch<InvoiceListResponse>(`/api/invoices${toQueryString(params)}`);
}

export function getInvoice(id: string): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/invoices/${id}`);
}
