"use client";
import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { buildLoginUrl } from "@/lib/auth/redirect";
import { isRouteAllowedForRole } from "@/lib/auth/routes";
import { useAppStore } from "@/store/app";
import { formatDocumentTitle, resolvePageTitle } from "@/lib/page-title";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { ToastHost } from "@/components/ui/toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoading: authLoading, isFetched, isAuthenticated } = useAuth();
  const user = useAppStore((s) => s.user);
  const collapsed = useAppStore((s) => s.collapsed);
  const setCollapsed = useAppStore((s) => s.setCollapsed);

  const roleDenied =
    isFetched &&
    !authLoading &&
    isAuthenticated &&
    user != null &&
    !isRouteAllowedForRole(user.role, pathname, {
      hasStores: user.hasStores,
    });

  useEffect(() => {
    if (isFetched && !authLoading && !isAuthenticated) {
      const query = searchParams.toString();
      const returnPath = query ? `${pathname}?${query}` : pathname;
      router.replace(buildLoginUrl(returnPath));
    }
  }, [isFetched, authLoading, isAuthenticated, router, pathname, searchParams]);

  useEffect(() => {
    if (roleDenied) {
      router.replace(
        user?.role === "super_admin" ? "/super-admin" : "/dashboard",
      );
    }
  }, [roleDenied, router, user?.role]);

  const title = resolvePageTitle(pathname);

  useEffect(() => {
    if (!isFetched || authLoading || !user || roleDenied) return;
    document.title = formatDocumentTitle(title);
  }, [title, isFetched, authLoading, user, roleDenied]);

  if (!isFetched || authLoading || !user || roleDenied) return null;

  return (
    <div className="app-frame">
      <Sidebar
        role={user.role}
        collapsed={collapsed}
        storeName={user.store}
        hasStores={user.hasStores}
      />
      <div className="app-main">
        <Navbar
          title={title}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
        <div className="app-content">
          <div className="app-content-inner">{children}</div>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
