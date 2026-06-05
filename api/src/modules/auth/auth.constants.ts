import { UserRole } from "@prisma/client";

export const SESSION_COOKIE_NAME = "better-auth.session_token";

export { UserRole };

/** Prisma enum values: `admin` | `branch_manager` */
export const USER_ROLES = [UserRole.admin, UserRole.branch_manager] as const;

export function parseTrustedOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function isPublicSignupAllowed(): boolean {
  if (process.env.ALLOW_PUBLIC_SIGNUP === "true") return true;
  if (process.env.ALLOW_PUBLIC_SIGNUP === "false") return false;
  return (process.env.NODE_ENV ?? "development") !== "production";
}

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}
