import type { PaginatedResponse } from "@/types/common/pagination";

export interface Organization {
  id: string;
  name: string;
  hasStores: boolean;
  billingEnabled: boolean;
  isActive: boolean;
  phone?: string | null;
  evcNumber?: string | null;
  edahabNumber?: string | null;
  accountNumber?: string | null;
  address?: string | null;
  logoKey?: string | null;
  logoUpdatedAt?: string | null;
  stampKey?: string | null;
  stampUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDetail extends Organization {
  _count: {
    users: number;
    stores: number;
  };
}

export interface OrganizationUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  store: { id: string; name: string } | null;
}

export interface OrganizationUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export type OrganizationUsersResponse = PaginatedResponse<OrganizationUser>;

export interface OrganizationListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateOrganizationInput {
  name: string;
  hasStores?: boolean;
}

export interface UpdateOrganizationInput {
  name?: string;
  hasStores?: boolean;
  billingEnabled?: boolean;
  isActive?: boolean;
}

export interface UpdateCurrentOrganizationInput {
  name?: string;
  phone?: string;
  evcNumber?: string;
  edahabNumber?: string;
  accountNumber?: string;
  address?: string;
}

export interface UpdateOrganizationUserInput {
  name?: string;
  email?: string;
  password?: string;
  phone?: string | null;
}

export interface PlatformStats {
  organizationCount: number;
  userCount: number;
}
