export type Role = "super_admin" | "admin" | "manager";

export interface Toast {
  id: number;
  kind?: "success" | "error";
  /** Shown as the toast message body. */
  title: string;
  sub?: string;
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
  store: string | null;
  organizationId: string | null;
  organizationName: string | null;
  hasStores: boolean | null;
}
