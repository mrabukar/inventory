import { apiFetch } from "@/service/client";
import type { PaginatedResponse } from "@/types/common/pagination";
import type {
  BranchPayment,
  BranchPaymentStatus,
  SubmitBranchPaymentInput,
} from "@/types/credit-branches/credit-branch";

export interface BranchPaymentListQuery {
  page?: number;
  limit?: number;
  status?: BranchPaymentStatus;
  storeId?: string;
  sortBy?: "createdAt" | "amount" | "paidAt";
  order?: "asc" | "desc";
}

function toQueryString(params: BranchPaymentListQuery = {}): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.order) search.set("order", params.order);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listBranchPayments(
  params: BranchPaymentListQuery = {},
): Promise<PaginatedResponse<BranchPayment>> {
  return apiFetch<PaginatedResponse<BranchPayment>>(
    `/api/branch-payments${toQueryString(params)}`,
  );
}

export interface PendingBranchPayments {
  count: number;
  /** What those payments add up to. */
  amount: number;
}

export function getPendingBranchPaymentsCount(): Promise<PendingBranchPayments> {
  return apiFetch<PendingBranchPayments>("/api/branch-payments/pending-count");
}

export function submitBranchPayment(
  input: SubmitBranchPaymentInput,
): Promise<BranchPayment> {
  return apiFetch<BranchPayment>("/api/branch-payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function approveBranchPayment(id: string): Promise<BranchPayment> {
  return apiFetch<BranchPayment>(`/api/branch-payments/${id}/approve`, {
    method: "PATCH",
  });
}

export function rejectBranchPayment(
  id: string,
  reason: string,
): Promise<BranchPayment> {
  return apiFetch<BranchPayment>(`/api/branch-payments/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}
