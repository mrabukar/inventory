import type { PaginatedResponse } from "@/types/common/pagination";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  organizationId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  /** The credit branch this customer belongs to, if any. */
  store?: { id: string; name: string } | null;
}

export interface CustomerListQuery {
  /** A credit branch to browse (admin only). */
  storeId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export type CustomerListResponse = PaginatedResponse<Customer>;

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;
