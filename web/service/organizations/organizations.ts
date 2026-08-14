import { apiFetch } from "@/service/client";
import type {
  CreateOrganizationInput,
  Organization,
  OrganizationDetail,
  OrganizationListQuery,
  OrganizationUsersQuery,
  OrganizationUsersResponse,
  PlatformStats,
  UpdateCurrentOrganizationInput,
  UpdateOrganizationInput,
} from "@/types/organizations/organization";
import type { PaginatedResponse } from "@/types/common/pagination";

export function listOrganizations(query: OrganizationListQuery = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiFetch<PaginatedResponse<Organization>>(
    `/api/organizations${qs ? `?${qs}` : ""}`,
  );
}

export function getOrganization(id: string) {
  return apiFetch<OrganizationDetail>(`/api/organizations/${id}`);
}

export function getCurrentOrganization() {
  return apiFetch<OrganizationDetail>("/api/organization");
}

export function updateCurrentOrganization(
  input: UpdateCurrentOrganizationInput,
) {
  return apiFetch<Organization>("/api/organization", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listOrganizationUsers(
  id: string,
  query: OrganizationUsersQuery = {},
) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiFetch<OrganizationUsersResponse>(
    `/api/organizations/${id}/users${qs ? `?${qs}` : ""}`,
  );
}

export function getPlatformStats() {
  return apiFetch<PlatformStats>("/api/organizations/stats");
}

export function createOrganization(input: CreateOrganizationInput) {
  return apiFetch<Organization>("/api/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateOrganization(id: string, input: UpdateOrganizationInput) {
  return apiFetch<Organization>(`/api/organizations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
