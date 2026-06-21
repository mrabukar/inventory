import { apiFetch } from "@/service/client";
import type {
  PurchaseListQuery,
  PurchaseListResponse,
} from "@/types/purchases/purchase";

function toQueryString(params: PurchaseListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.productId) search.set("productId", params.productId);
  if (params.invoiceNumber) search.set("invoiceNumber", params.invoiceNumber);
  if (params.categoryId != null)
    search.set("categoryId", String(params.categoryId));
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listPurchases(
  params: PurchaseListQuery = {},
): Promise<PurchaseListResponse> {
  return apiFetch<PurchaseListResponse>(
    `/api/purchases${toQueryString(params)}`,
  );
}

export function listProductPurchases(
  productId: string,
  params: PurchaseListQuery = {},
): Promise<PurchaseListResponse> {
  return apiFetch<PurchaseListResponse>(
    `/api/products/${productId}/purchases${toQueryString(params)}`,
  );
}
