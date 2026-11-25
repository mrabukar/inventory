export type Role = "super_admin" | "admin" | "manager" | "limited";

export function appRoleLabel(role: Role | undefined): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Administrator";
  if (role === "limited") return "Limited user";
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
  /** For a limited user: the pages they may see. */
  allowedPages: string[];
  /** Without stores: true = credit organization, false = direct sales. */
  usesCreditBranches: boolean | null;
  billingEnabled: boolean | null;
  organizationLogoKey: string | null;
  organizationLogoUpdatedAt: string | null;
}
