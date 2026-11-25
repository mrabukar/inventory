"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

import { useCreditBranches } from "@/hooks/credit-branches/use-credit-branches";
import { ALL_BRANCHES } from "@/lib/branch-scope";
import { useAppStore } from "@/store/app";
import { useBranchViewStore } from "@/store/branch-view";

/**
 * Pages whose data follows the selected branch automatically: each page's data
 * hook adds it as `storeId`. Purchases, the audit log, users and the two
 * approval pages read the selection themselves. Everything else (warehouse,
 * stock report, expenses, products, stores, the credit branch screens) is
 * about the organization itself and ignores it.
 */
export const BRANCH_VIEW_ROUTES = [
  "/dashboard",
  "/sales",
  "/inventory",
  "/financial",
  "/customers",
  "/invoices",
  "/payments",
  "/receivables",
] as const;

export function isBranchViewRoute(pathname: string): boolean {
  return BRANCH_VIEW_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/** Only the admin (or a limited user) of a credit organization looks at its credit branches. */
function useCanBrowseBranches(): boolean {
  const user = useAppStore((s) => s.user);
  return (
    (user?.role === "admin" || user?.role === "limited") &&
    user.hasStores === false &&
    user.usesCreditBranches === true
  );
}

/**
 * What the admin has chosen: null for the organization itself, "all" for every
 * branch together, or one branch's id. Always null for anyone else.
 */
export function useBranchScope(): string | null {
  const canBrowse = useCanBrowseBranches();
  const value = useBranchViewStore((s) => s.branchId);
  const { data: branches, isLoading } = useCreditBranches({
    enabled: canBrowse,
  });
  if (!canBrowse) return null;
  // Before the first branch exists there is only the organization to look at.
  if (
    value === ALL_BRANCHES &&
    !isLoading &&
    branches !== undefined &&
    branches.length === 0
  ) {
    return null;
  }
  return value;
}

/**
 * The `storeId` this page's data should use, or undefined for the organization's
 * own. Data hooks call this so the pages themselves need no changes.
 */
export function useViewBranchId(): string | undefined {
  const pathname = usePathname();
  const scope = useBranchScope();
  return scope && isBranchViewRoute(pathname) ? scope : undefined;
}

/**
 * The `storeId` the audit log and the user list send. A credit organization's
 * default view ("own") leaves its branches' people out; undefined elsewhere.
 */
export function usePeopleStoreFilter(): string | undefined {
  const canBrowse = useCanBrowseBranches();
  const scope = useBranchScope();
  return canBrowse ? (scope ?? "own") : undefined;
}

/** True while looking at one branch or at all of them: the view is read-only. */
export function useBrowsingBranches(): boolean {
  return Boolean(useViewBranchId());
}

/**
 * True when nothing on the page may change data: a limited user always, and
 * anyone looking at the branches. Pages hide their add, edit, delete, approve
 * and record buttons on this (the API refuses those calls regardless).
 */
export function useReadOnlyView(): boolean {
  const limited = useAppStore((s) => s.user?.role === "limited");
  // Always called, never skipped by the `||`.
  const browsing = useBrowsingBranches();
  return limited || browsing;
}

/** Adds the selected branch to a query's params (leaves them alone when none is selected). */
export function useBranchScoped<T extends { storeId?: string }>(params: T): T {
  const scope = useViewBranchId();
  return useMemo(
    () => (scope ? { ...params, storeId: scope } : params),
    [params, scope],
  );
}

/** The selector's view of the choice, checked against the real list of branches. */
export function useBranchScopeControl() {
  const canBrowse = useCanBrowseBranches();
  const value = useBranchViewStore((s) => s.branchId);
  const setBranchId = useBranchViewStore((s) => s.setBranchId);
  const { data: branches = [], isLoading } = useCreditBranches({
    enabled: canBrowse,
  });

  const select = useCallback(
    (id: string | null) => setBranchId(id),
    [setBranchId],
  );

  // A branch that no longer exists (or another organization's, left over in
  // this tab) falls back to all branches.
  const stale =
    canBrowse &&
    !isLoading &&
    value !== null &&
    value !== ALL_BRANCHES &&
    !branches.some((branch) => branch.id === value);
  useEffect(() => {
    if (stale) setBranchId(ALL_BRANCHES);
  }, [stale, setBranchId]);

  return {
    enabled: canBrowse && (isLoading || branches.length > 0),
    branches,
    isLoading,
    value: canBrowse && !stale ? value : null,
    select,
  };
}
