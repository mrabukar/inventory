/** Routes that require an authenticated session (under app/(app)). */
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/products",
  "/inventory",
  "/stock-report",
  "/sales",
  "/supply",
  "/expenses",
  "/financial",
  "/users",
  "/audit",
  "/submit-sale",
  "/my-stock",
  "/sales-history",
] as const;

/** Admin-only routes — branch managers must not access these. */
export const ADMIN_ONLY_ROUTE_PREFIXES = [
  "/products",
  "/inventory",
  "/stock-report",
  "/sales",
  "/supply",
  "/expenses",
  "/financial",
  "/users",
  "/audit",
] as const;

/** Manager-only routes — admins must not access these. */
export const MANAGER_ONLY_ROUTE_PREFIXES = [
  "/submit-sale",
  "/my-stock",
  "/sales-history",
] as const;

export const PUBLIC_ROUTE_PREFIXES = ["/login"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isManagerOnlyPath(pathname: string): boolean {
  return MANAGER_ONLY_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isRouteAllowedForRole(
  role: "admin" | "manager",
  pathname: string,
): boolean {
  if (role === "admin" && isManagerOnlyPath(pathname)) return false;
  if (role === "manager" && isAdminOnlyPath(pathname)) return false;
  return true;
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}
