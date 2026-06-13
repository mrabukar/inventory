export type ApiRole = "admin" | "branch_manager";

export interface MeStore {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  storeId: string | null;
  isActive: boolean;
  store?: MeStore | null;
}

export interface MeResponse {
  user: ApiUser;
}
