import type { PaginatedResponse } from "@/types/common/pagination";
import type { Store } from "@/types/stores/store";

export type UserRole = "admin" | "branch_manager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  isActive: boolean;
  storeId: string | null;
  store: Pick<Store, "id" | "name"> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

export type UserListResponse = PaginatedResponse<User>;

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  storeId?: string;
  phone?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  storeId?: string | null;
  phone?: string | null;
}

export const ROLE_ITEMS = [
  { value: "admin" as const, label: "Admin" },
  { value: "branch_manager" as const, label: "Branch Manager" },
];

export function roleLabel(role: UserRole | string): string {
  if (role === "admin") return "Admin";
  return "Branch Manager";
}
