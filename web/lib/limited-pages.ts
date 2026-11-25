/**
 * The pages an admin can give a limited user, in menu order. Keys match the
 * API's catalog (`api/src/common/access/limited-pages.ts`) and are stored on
 * the user, so never rename one.
 */
export interface LimitedPage {
  key: string;
  label: string;
  /** Where the page lives, and where the user lands. */
  href: string;
  /** Paths under `href` that belong to another page or change data. */
  exclude?: string[];
  /** Only credit organizations have this page. */
  creditOnly?: boolean;
}

export const LIMITED_PAGES: LimitedPage[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "categories", label: "Categories", href: "/categories" },
  { key: "products", label: "Products", href: "/products" },
  {
    key: "purchases",
    label: "Purchases",
    href: "/purchases",
    exclude: ["/purchases/new"],
  },
  { key: "warehouse", label: "Warehouse", href: "/warehouse" },
  { key: "inventory", label: "Inventory", href: "/inventory" },
  { key: "stock-report", label: "Stock report", href: "/stock-report" },
  {
    key: "sales",
    label: "Sales",
    href: "/sales",
    exclude: ["/sales/approvals"],
  },
  { key: "expenses", label: "Expenses", href: "/expenses" },
  {
    key: "sale-approvals",
    label: "Sale approvals",
    href: "/sales/approvals",
    creditOnly: true,
  },
  {
    key: "credit-branches",
    label: "Credit branches",
    href: "/credit-branches",
    exclude: ["/credit-branches/payments"],
    creditOnly: true,
  },
  {
    key: "branch-payments",
    label: "Branch payments",
    href: "/credit-branches/payments",
    creditOnly: true,
  },
  { key: "customers", label: "Customers", href: "/customers" },
  { key: "invoices", label: "Invoices", href: "/invoices" },
  { key: "payments", label: "Payments", href: "/payments" },
  { key: "receivables", label: "Receivables", href: "/receivables" },
  { key: "users", label: "Users", href: "/users" },
  { key: "audit", label: "Audit log", href: "/audit" },
  { key: "financial", label: "Financial summary", href: "/financial" },
];

/** The pages that exist for an organization (limited users: credit and direct only). */
export function pagesAvailableTo(org: {
  hasStores: boolean | null;
  usesCreditBranches: boolean | null;
}): LimitedPage[] {
  if (org.hasStores !== false) return [];
  return LIMITED_PAGES.filter(
    (page) => !page.creditOnly || org.usesCreditBranches === true,
  );
}

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Which page a path belongs to, or null (settings, a form that changes data, an unknown path). */
export function pageKeyForPath(pathname: string): string | null {
  const matches = LIMITED_PAGES.filter(
    (page) =>
      under(pathname, page.href) &&
      !(page.exclude ?? []).some((path) => under(pathname, path)),
  );
  // The most specific path wins ("/sales/approvals" over "/sales").
  matches.sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.key ?? null;
}

/** Pages every signed-in user keeps: their own profile, password and two-factor setup. */
const ACCOUNT_PATHS = ["/settings/profile", "/settings/password", "/setup-2fa"];

export function limitedUserMayOpen(
  pathname: string,
  allowedPages: readonly string[],
): boolean {
  if (ACCOUNT_PATHS.some((path) => under(pathname, path))) return true;
  const key = pageKeyForPath(pathname);
  return key !== null && allowedPages.includes(key);
}

/** The first page a limited user holds, in menu order, or their profile when they hold none. */
export function limitedUserHome(allowedPages: readonly string[]): string {
  const first = LIMITED_PAGES.find((page) => allowedPages.includes(page.key));
  return first?.href ?? "/settings/profile";
}
