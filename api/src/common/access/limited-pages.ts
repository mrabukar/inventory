/**
 * The pages an admin can give a limited user. A limited user sees only these,
 * read-only. Keys are stored on the user, so never rename one.
 */
export const LIMITED_PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "categories", label: "Categories" },
  { key: "products", label: "Products" },
  { key: "purchases", label: "Purchases" },
  { key: "warehouse", label: "Warehouse" },
  { key: "inventory", label: "Inventory" },
  { key: "stock-report", label: "Stock Report" },
  { key: "sales", label: "Sales" },
  { key: "sale-approvals", label: "Sale approvals", creditOnly: true },
  { key: "expenses", label: "Expenses" },
  { key: "credit-branches", label: "Credit branches", creditOnly: true },
  { key: "branch-payments", label: "Branch payments", creditOnly: true },
  { key: "customers", label: "Customers" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "receivables", label: "Receivables" },
  { key: "users", label: "Users" },
  { key: "audit", label: "Audit log" },
  { key: "financial", label: "Financial summary" },
] as const;

export type LimitedPageKey = (typeof LIMITED_PAGES)[number]["key"];

export const LIMITED_PAGE_KEYS = LIMITED_PAGES.map(
  (page) => page.key,
) as unknown as readonly LimitedPageKey[];

/** A route readable by a limited user who holds at least one page. */
export const ANY_PAGE = "*" as const;
export type PageMark = LimitedPageKey | typeof ANY_PAGE;

export function isLimitedPageKey(value: unknown): value is LimitedPageKey {
  return (
    typeof value === "string" &&
    (LIMITED_PAGE_KEYS as readonly string[]).includes(value)
  );
}

/**
 * The pages that exist for an organization. Limited users are only for
 * organizations without stores; the sale approval and credit branch pages are
 * for credit organizations only.
 */
export function pagesAvailableTo(org: {
  hasStores: boolean;
  usesCreditBranches: boolean;
}): LimitedPageKey[] {
  if (org.hasStores) return [];
  return LIMITED_PAGES.filter(
    (page) =>
      !("creditOnly" in page && page.creditOnly) || org.usesCreditBranches,
  ).map((page) => page.key);
}

/** Why a list of pages can't be given to a limited user in this organization, or null if it can. */
export function invalidPagesReason(
  pages: unknown,
  org: { hasStores: boolean; usesCreditBranches: boolean },
): string | null {
  if (org.hasStores) {
    return "Limited users are for organizations without stores";
  }
  if (!Array.isArray(pages) || pages.length === 0) {
    return "Give a limited user at least one page";
  }
  const available = new Set<string>(pagesAvailableTo(org));
  const unknown = pages.filter(
    (page) => typeof page !== "string" || !available.has(page),
  );
  if (unknown.length > 0) {
    return `These pages aren't available here: ${unknown.join(", ")}`;
  }
  return null;
}
