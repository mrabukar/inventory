"use client";
import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { buildLoginUrl } from "@/lib/auth/redirect";
import { useAppStore } from "@/store/app";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { ToastHost } from "@/components/ui/toast";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":     "Dashboard",
  "/products":      "Products",
  "/inventory":     "Inventory",
  "/sales":         "Sales",
  "/supply":        "Stock Supply",
  "/expenses":      "Expenses",
  "/financial":     "Financial Summary",
  "/users":         "Users",
  "/audit":         "Audit Log",
  "/submit-sale":   "Submit Sale",
  "/my-stock":      "My Stock",
  "/sales-history": "Sales History",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const user = useAppStore((s) => s.user);
  const collapsed = useAppStore((s) => s.collapsed);
  const setCollapsed = useAppStore((s) => s.setCollapsed);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const query = searchParams.toString();
      const returnPath = query ? `${pathname}?${query}` : pathname;
      router.replace(buildLoginUrl(returnPath));
    }
  }, [authLoading, isAuthenticated, router, pathname, searchParams]);

  if (authLoading || !user) return null;

  const title = PAGE_TITLES[pathname] ?? "Dashboard";

  return (
    <div className="app-frame">
      <Sidebar role={user.role} collapsed={collapsed} storeName={user.store} />
      <div className="app-main">
        <Navbar title={title} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="app-content">
          <div className="app-content-inner">{children}</div>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
