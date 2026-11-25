"use client";

import { useMemo } from "react";

import { useAdminDashboard } from "@/hooks/reports/admin-dashboard";
import { useReportFilters } from "@/hooks/filters/use-report-filters";
import { useViewBranchId } from "@/hooks/branch-view/use-branch-view";
import { useCreditBranches } from "@/hooks/credit-branches/use-credit-branches";
import { useReceivables } from "@/hooks/payments/use-payments";
import { AdminPerformanceCharts } from "./components/admin/performance-charts";
// import { AdminProductDistributionChart } from "./components/admin/product-distribution-chart";
import { AdminRevenueCharts } from "./components/admin/revenue-charts";
import { AdminStatGrid } from "./components/admin/stat-grid";
import { AdminStockAlertsTable } from "./components/admin/stock-alerts-table";
import { AdminStockSection } from "./components/admin/stock-section";
import { BranchesOweChart } from "./components/admin/branches-owe-chart";
import { DashboardScopeNote } from "./components/admin/scope-note";
import { DashboardError, DashboardLoading } from "./components/admin/status";
import { DashboardPageHeader } from "./components/admin/page-header";
import { ALL_BRANCHES } from "@/lib/branch-scope";
import { useAppStore } from "@/store/app";

export function AdminDashboard() {
  const billingEnabled = useAppStore((s) => s.user?.billingEnabled ?? false);
  const filters = useReportFilters();
  // Looking at a credit branch: it has no expenses, and its profit is revenue less what it paid.
  const viewBranchId = useViewBranchId();
  const branchView = Boolean(viewBranchId);
  // "All branches" is a view of every branch together, not one branch.
  const allBranches = viewBranchId === ALL_BRANCHES;
  const singleBranchId = branchView && !allBranches ? viewBranchId : undefined;
  // The Branches Owe chart: on the organization's own dashboard and for all branches.
  const hasStores = useAppStore((s) => s.user?.hasStores ?? true);
  const creditOrg = useAppStore((s) => s.user?.usesCreditBranches === true);
  const showBranchesOwe = !hasStores && creditOrg && !singleBranchId;
  const {
    data: branches,
    isLoading: branchesLoading,
    isError: branchesError,
  } = useCreditBranches({ enabled: !hasStores && creditOrg });
  // What the branches still owe; a branch that paid ahead owes nothing.
  const branchesOwe = (branches ?? []).reduce(
    (sum, b) => sum + Math.max(b.balance, 0),
    0,
  );
  // A credit organization's own view has no customers of its own to speak of:
  // what is outstanding to it is mainly what its branches owe.
  const orgOwedByBranches = !hasStores && creditOrg && !viewBranchId;
  const dashboardQuery = useMemo(
    () => ({
      fromDate: filters.query.fromDate,
      toDate: filters.query.toDate,
      storeId: filters.query.storeId,
    }),
    [filters.query.fromDate, filters.query.toDate, filters.query.storeId],
  );
  const { data, isLoading, isError, error } = useAdminDashboard(dashboardQuery);
  const { data: receivables = [] } = useReceivables(billingEnabled);
  const outstandingBalance = useMemo(
    () => receivables.reduce((sum, r) => sum + r.balance, 0),
    [receivables],
  );

  const header = <DashboardPageHeader filters={filters} />;

  if (isLoading) {
    return (
      <>
        {header}
        <DashboardLoading />
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        {header}
        <DashboardError message={error instanceof Error ? error.message : "Failed to load dashboard."} />
      </>
    );
  }

  const { summary, comparison, charts, recentSales } = data;

  return (
    <>
      {header}

      {!hasStores && creditOrg ? (
        <DashboardScopeNote
          scope={singleBranchId ? "branch" : allBranches ? "all" : "organization"}
          branchName={branches?.find((b) => b.id === singleBranchId)?.name}
        />
      ) : null}
      <AdminStatGrid
        summary={summary}
        comparison={comparison}
        billingEnabled={billingEnabled}
        outstandingBalance={
          orgOwedByBranches ? outstandingBalance + branchesOwe : outstandingBalance
        }
        outstandingHref={orgOwedByBranches ? "/credit-branches" : undefined}
      />
      {showBranchesOwe ? (
        <BranchesOweChart
          branches={branches ?? []}
          isLoading={branchesLoading}
          isError={branchesError}
        />
      ) : null}
      <AdminRevenueCharts charts={charts} />
      {/* <AdminProductDistributionChart filters={filters} /> */}
      <AdminPerformanceCharts
        charts={charts}
        branchView={branchView}
        allBranches={allBranches}
      />
      <AdminStockSection stockByCategory={charts.stockByCategory} recentSales={recentSales} />
      <AdminStockAlertsTable
        storeId={viewBranchId ?? filters.query.storeId}
        lowStockCount={summary.lowStockCount}
        outOfStockCount={summary.outOfStockCount}
      />
    </>
  );
}
