import { UserRole } from "@prisma/client";

export const SESSION_COOKIE_NAME = "better-auth.session_token";

/** Shown as the authenticator-app issuer (e.g. "Inventory: user@email"). */
export const AUTH_APP_NAME = "Inventory";

export { UserRole };

/** Prisma enum values: `super_admin` | `admin` | `branch_manager` | `limited_user` */
export const USER_ROLES = [
  UserRole.super_admin,
  UserRole.admin,
  UserRole.branch_manager,
  UserRole.limited_user,
] as const;

export function parseTrustedOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

/** The roles an organization admin may give a user. Never super_admin. */
export const ASSIGNABLE_USER_ROLES = [
  UserRole.admin,
  UserRole.branch_manager,
  UserRole.limited_user,
] as const;

/**
 * Better-Auth endpoints switched off. `/update-user` lets any signed-in user
 * change their own account fields, role and organization included; profile
 * edits go through PATCH /me.
 */
export const DISABLED_AUTH_PATHS = ["/update-user"];

/** Fields that decide what a user may reach. Better-Auth must never update them. */
const ACCESS_FIELDS = [
  "role",
  "organizationId",
  "storeId",
  "isActive",
  // A limited user's pages are changed only by an admin, through our own service.
  "allowedPages",
] as const;

/** True when an update tries to set a field that decides a user's access. */
export function changesUserAccess(data: Record<string, unknown>): boolean {
  return ACCESS_FIELDS.some((field) => data[field] !== undefined);
}
