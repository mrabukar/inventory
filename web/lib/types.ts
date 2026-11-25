export type Role = "super_admin" | "admin" | "manager";

export function appRoleLabel(role: Role | undefined): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Administrator";
  return "Branch Manager";
}

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
  phone: string | null;
  role: Role;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  storeId: string | null;
  store: string | null;
  isCreditBranch: boolean;
  organizationId: string | null;
  organizationName: string | null;
  hasStores: boolean | null;
  /** Without stores: true = credit organization, false = direct sales. */
  usesCreditBranches: boolean | null;
  billingEnabled: boolean | null;
  organizationLogoKey: string | null;
  organizationLogoUpdatedAt: string | null;
}
