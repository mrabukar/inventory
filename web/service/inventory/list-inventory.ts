import { apiFetch } from "@/service/client";
import type {
  InventoryListQuery,
  InventoryListResponse,
  InventoryListScope,
} from "@/types/inventory/inventory";

const SCOPE_PATH: Record<InventoryListScope, string> = {
  all: "/api/inventory",
  "low-stock": "/api/inventory/low-stock",
  "out-of-stock": "/api/inventory/out-of-stock",
};

function toQueryString(params: InventoryListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.categoryId != null)
    search.set("categoryId", String(params.categoryId));
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.productId) search.set("productId", params.productId);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listInventory(
  params: InventoryListQuery = {},
  scope: InventoryListScope = "all",
): Promise<InventoryListResponse> {
  return apiFetch<InventoryListResponse>(
    `${SCOPE_PATH[scope]}${toQueryString(params)}`,
  );
}
