import { apiFetch } from "@/service/client";
import type {
  InventoryListQuery,
  InventoryListResponse,
} from "@/types/inventory/inventory";

function toQueryString(params: InventoryListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.categoryId != null)
    search.set("categoryId", String(params.categoryId));
  if (params.productId) search.set("productId", params.productId);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listWarehouseInventory(
  params: InventoryListQuery = {},
): Promise<InventoryListResponse> {
  return apiFetch<InventoryListResponse>(
    `/api/inventory/warehouse${toQueryString(params)}`,
  );
}
