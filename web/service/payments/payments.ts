import { apiFetch } from "@/service/client";
import type { PaginatedResponse } from "@/types/common/pagination";
import type {
  CreatePaymentInput,
  Payment,
  PaymentListQuery,
} from "@/types/payments/payment";

function toQueryString(params: PaymentListQuery = {}): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.customerId) search.set("customerId", params.customerId);
  if (params.invoiceId) search.set("invoiceId", params.invoiceId);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listPayments(
  params: PaymentListQuery = {},
): Promise<PaginatedResponse<Payment>> {
  return apiFetch<PaginatedResponse<Payment>>(
    `/api/payments${toQueryString(params)}`,
  );
}

export function createPayment(input: CreatePaymentInput): Promise<Payment> {
  return apiFetch<Payment>("/api/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
