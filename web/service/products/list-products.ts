import { apiFetch } from "@/service/client";
import type {
  ProductListQuery,
  ProductListResponse,
} from "@/types/products/product";

function toQueryString(params: ProductListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.categoryId != null)
    search.set("categoryId", String(params.categoryId));
  if (params.missingOpeningCost === true)
    search.set("missingOpeningCost", "true");

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listProducts(
  params: ProductListQuery = {},
): Promise<ProductListResponse> {
  return apiFetch<ProductListResponse>(`/api/products${toQueryString(params)}`);
}
