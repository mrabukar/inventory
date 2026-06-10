import { apiFetch } from "@/service/client";
import type { UserListQuery, UserListResponse } from "@/types/users/user";

function toQueryString(params: UserListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.role) search.set("role", params.role);
  if (params.isActive != null) search.set("isActive", String(params.isActive));

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listUsers(params: UserListQuery = {}): Promise<UserListResponse> {
  return apiFetch<UserListResponse>(`/api/users${toQueryString(params)}`);
}
