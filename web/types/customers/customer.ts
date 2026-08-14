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
}

export interface CustomerListQuery {
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
