import { apiFetch } from "@/service/client";
import type {
  StockSupplyListQuery,
  StockSupplyListResponse,
} from "@/types/stock-supplies/stock-supply";

function toQueryString(params: StockSupplyListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.productId) search.set("productId", params.productId);
  if (params.categoryId != null)
    search.set("categoryId", String(params.categoryId));
  if (params.type) search.set("type", params.type);
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listStockSupplies(
  params: StockSupplyListQuery = {},
): Promise<StockSupplyListResponse> {
  return apiFetch<StockSupplyListResponse>(
    `/api/stock-supplies${toQueryString(params)}`,
  );
}
