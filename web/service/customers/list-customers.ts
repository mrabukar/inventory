import { apiFetch } from "@/service/client";
import type {
  Customer,
  CustomerListQuery,
  CustomerListResponse,
} from "@/types/customers/customer";

function toQueryString(params: CustomerListQuery = {}): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listCustomers(
  params: CustomerListQuery = {},
): Promise<CustomerListResponse> {
  return apiFetch<CustomerListResponse>(
    `/api/customers${toQueryString(params)}`,
  );
}

export function getCustomer(id: string): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`);
}
