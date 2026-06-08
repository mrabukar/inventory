export type ApiRole = "admin" | "branch_manager";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  storeId: string | null;
  isActive: boolean;
}

export interface MeResponse {
  user: ApiUser;
}
