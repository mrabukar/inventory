export type ApiRole = "super_admin" | "admin" | "branch_manager";

export interface MeStore {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
}

export interface MeOrganization {
  id: string;
  name: string;
  hasStores: boolean;
  logoKey?: string | null;
  logoUpdatedAt?: string | null;
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  storeId: string | null;
  organizationId?: string | null;
  isActive: boolean;
  store?: MeStore | null;
  organization?: MeOrganization | null;
}

export interface MeResponse {
  user: ApiUser;
}
