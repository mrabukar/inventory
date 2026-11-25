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
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
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
  /** "own", "all", or a credit branch's id (credit organizations only). */
  storeId?: string;
}

export type UserListResponse = PaginatedResponse<User>;

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  storeId?: string;
  phone?: string;
  /** Defaults to true. When false the user signs in with only a password. */
  twoFactorRequired?: boolean;
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

export type TwoFactorAction = "disable" | "require" | "reset";

export type TwoFactorState = "on" | "off" | "pending";

/** on = authenticator set up; pending = required but not set up yet; off = password only. */
export function twoFactorState(
  user: Pick<User, "twoFactorEnabled" | "twoFactorRequired">,
): TwoFactorState {
  if (user.twoFactorEnabled) return "on";
  return user.twoFactorRequired ? "pending" : "off";
}

export function roleLabel(role: UserRole | string): string {
  if (role === "admin") return "Admin";
  return "Branch Manager";
}
