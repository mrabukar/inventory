import { apiFetch } from "@/service/client";
import type { StoreListQuery, StoreListResponse } from "@/types/stores/store";

function toQueryString(params: StoreListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listStores(params: StoreListQuery = {}): Promise<StoreListResponse> {
  return apiFetch<StoreListResponse>(`/api/stores${toQueryString(params)}`);
}
