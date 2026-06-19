import { UserRole } from "@prisma/client";

export const SESSION_COOKIE_NAME = "better-auth.session_token";

export { UserRole };

/** Prisma enum values: `super_admin` | `admin` | `branch_manager` */
export const USER_ROLES = [
  UserRole.super_admin,
  UserRole.admin,
  UserRole.branch_manager,
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
