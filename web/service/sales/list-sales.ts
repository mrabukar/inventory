import { apiFetch } from "@/service/client";
import type { SaleListQuery, SaleListResponse } from "@/types/sales/sale";

function toQueryString(params: SaleListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.categoryId != null)
    search.set("categoryId", String(params.categoryId));
  if (params.status) search.set("status", params.status);
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listSales(
  params: SaleListQuery = {},
): Promise<SaleListResponse> {
  return apiFetch<SaleListResponse>(`/api/sales${toQueryString(params)}`);
}
