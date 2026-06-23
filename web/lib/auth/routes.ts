/** Routes that require an authenticated session (under app/(app)). */
import type { Role } from "@/lib/types";

export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/products",
  "/purchases",
  "/warehouse",
  "/inventory",
  "/stock-report",
  "/sales",
  "/supply",
  "/expenses",
  "/financial",
  "/categories",
  "/stores",
  "/users",
  "/audit",
  "/submit-sale",
  "/my-stock",
  "/sales-history",
  "/settings/organization",
  "/settings/profile",
  "/settings/password",
] as const;

export const SUPER_ADMIN_ROUTE_PREFIXES = ["/super-admin"] as const;

/** Account settings — all authenticated roles including super_admin. */
export const ACCOUNT_SETTINGS_ROUTE_PREFIXES = [
  "/settings/profile",
  "/settings/password",
] as const;

/** Admin-only routes — branch managers must not access these. */
export const ADMIN_ONLY_ROUTE_PREFIXES = [
  "/products",
  "/purchases",
  "/warehouse",
  "/inventory",
  "/stock-report",
  "/sales",
  "/supply",
  "/expenses",
  "/financial",
  "/categories",
  "/stores",
  "/users",
  "/audit",
  "/settings/organization",
] as const;

/** Manager-only routes — admins must not access these (unless hasStores is false). */
export const MANAGER_ONLY_ROUTE_PREFIXES = [
  "/submit-sale",
  "/my-stock",
  "/sales-history",
] as const;

export const PUBLIC_ROUTE_PREFIXES = ["/login"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAccountSettingsPath(pathname: string): boolean {
  return ACCOUNT_SETTINGS_ROUTE_PREFIXES.some((prefix) =>
    matchesPrefix(pathname, prefix),
  );
}

export function isSuperAdminPath(pathname: string): boolean {
  return SUPER_ADMIN_ROUTE_PREFIXES.some((prefix) =>
    matchesPrefix(pathname, prefix),
  );
}

export function isProtectedPath(pathname: string): boolean {
  return (
    PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix)) ||
    isSuperAdminPath(pathname)
  );
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_ROUTE_PREFIXES.some((prefix) =>
    matchesPrefix(pathname, prefix),
  );
}

export function isManagerOnlyPath(pathname: string): boolean {
  return MANAGER_ONLY_ROUTE_PREFIXES.some((prefix) =>
    matchesPrefix(pathname, prefix),
  );
}

export function isRouteAllowedForRole(
  role: Role,
  pathname: string,
  options?: { hasStores?: boolean | null },
): boolean {
  if (role === "super_admin") {
    return isSuperAdminPath(pathname) || isAccountSettingsPath(pathname);
  }

  if (isSuperAdminPath(pathname)) {
    return false;
  }

  if (role === "admin" && isManagerOnlyPath(pathname)) {
    if (pathname === "/submit-sale" && options?.hasStores === false) {
      return true;
    }
    return false;
  }

  if (role === "manager" && isAdminOnlyPath(pathname)) {
    return false;
  }

  return true;
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}
