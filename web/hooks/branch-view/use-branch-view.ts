"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";

import { useCreditBranches } from "@/hooks/credit-branches/use-credit-branches";
import { useAppStore } from "@/store/app";
import { useBranchViewStore } from "@/store/branch-view";

/**
 * Pages that can show a credit branch's data. Every other page (purchases,
 * warehouse, expenses, products, stores, users, the credit branch screens…)
 * is about the organization itself and ignores the selection.
 */
export const BRANCH_VIEW_ROUTES = [
  "/dashboard",
  "/sales",
  "/inventory",
  "/stock-report",
  "/financial",
  "/customers",
  "/invoices",
  "/payments",
  "/receivables",
] as const;

/** What the switcher and banner call the organization's own data (only organizations without stores browse branches). */
export const BRANCH_VIEW_HOME_LABEL = "Fonex";

export function isBranchViewRoute(pathname: string): boolean {
  return BRANCH_VIEW_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/** Only the admin of a credit organization browses credit branches. */
function useCanBrowseBranches(): boolean {
  const user = useAppStore((s) => s.user);
  return (
    user?.role === "admin" &&
    user.hasStores === false &&
    user.usesCreditBranches === true
  );
}

/**
 * The credit branch whose data this page should show, or undefined for the
 * organization's own. Data hooks call this so pages need no changes.
 */
export function useViewBranchId(): string | undefined {
  const pathname = usePathname();
  const canBrowse = useCanBrowseBranches();
  const branchId = useBranchViewStore((s) => s.branchId);
  return canBrowse && branchId && isBranchViewRoute(pathname)
    ? branchId
    : undefined;
}

/** Adds the selected branch to a query's params (leaves them alone when none is selected). */
export function useBranchScoped<T extends { storeId?: string }>(params: T): T {
  const branchId = useViewBranchId();
  return useMemo(
    () => (branchId ? { ...params, storeId: branchId } : params),
    [params, branchId],
  );
}

/** The switcher's and banner's view of the selection, checked against the real branch list. */
export function useBranchView() {
  const pathname = usePathname();
  const canBrowse = useCanBrowseBranches();
  const branchId = useBranchViewStore((s) => s.branchId);
  const setBranchId = useBranchViewStore((s) => s.setBranchId);
  const { data: branches = [], isLoading } = useCreditBranches({
    enabled: canBrowse,
  });

  const onBranchPage = isBranchViewRoute(pathname);
  const selected = branches.find((b) => b.id === branchId) ?? null;
  const select = useCallback(
    (id: string | null) => setBranchId(id),
    [setBranchId],
  );

  return {
    organizationName: BRANCH_VIEW_HOME_LABEL,
    enabled: canBrowse && (isLoading || branches.length > 0),
    onBranchPage,
    branches,
    isLoading,
    selected,
    /** True when the selection points at a branch that no longer exists. */
    stale: Boolean(branchId) && !isLoading && !selected && canBrowse,
    select,
  };
}
