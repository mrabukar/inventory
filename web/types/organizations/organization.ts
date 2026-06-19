export interface Organization {
  id: string;
  name: string;
  hasStores: boolean;
  isActive: boolean;
  logoKey?: string | null;
  logoUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDetail extends Organization {
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  }>;
  _count: {
    users: number;
    stores: number;
  };
}

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
  isActive?: boolean;
}

export interface PlatformStats {
  organizationCount: number;
  userCount: number;
}
