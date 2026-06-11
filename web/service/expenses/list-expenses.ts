import { apiFetch } from "@/service/client";
import type { ExpenseListQuery, ExpenseListResponse } from "@/types/expenses/expense";

function toQueryString(params: ExpenseListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.categoryId != null)
    search.set("categoryId", String(params.categoryId));
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.companyWideOnly != null)
    search.set("companyWideOnly", String(params.companyWideOnly));
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listExpenses(
  params: ExpenseListQuery = {},
): Promise<ExpenseListResponse> {
  return apiFetch<ExpenseListResponse>(`/api/expenses${toQueryString(params)}`);
}
