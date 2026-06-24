export const APP_NAME = "inventory";

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/purchases": "Purchases",
  "/warehouse": "Warehouse",
  "/inventory": "Inventory",
  "/stock-report": "Stock Report",
  "/sales": "Sales",
  "/supply": "Distribute to Store",
  "/expenses": "Expenses",
  "/financial": "Financial Summary",
  "/categories": "Categories",
  "/stores": "Stores",
  "/users": "Users",
  "/audit": "Audit Log",
  "/submit-sale": "Submit Sale",
  "/my-stock": "My Stock",
  "/sales-history": "Sales History",
  "/settings/profile": "Profile",
  "/settings/password": "Change Password",
  "/settings/organization": "Organization",
  "/super-admin": "Platform",
  "/super-admin/organizations": "Organizations",
  "/super-admin/organizations/new": "New Organization",
  "/login": "Sign In",
};

export function resolvePageTitle(pathname: string): string {
  return (
    PAGE_TITLES[pathname] ??
    (pathname.startsWith("/super-admin/organizations/")
      ? "Organization"
      : "Dashboard")
  );
}

export function formatDocumentTitle(pageTitle: string): string {
  return `${pageTitle} · ${APP_NAME}`;
}
