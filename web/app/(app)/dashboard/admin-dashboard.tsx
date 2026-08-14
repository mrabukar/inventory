"use client";

import { useMemo } from "react";

import { useAdminDashboard } from "@/hooks/reports/admin-dashboard";
import { useReportFilters } from "@/hooks/filters/use-report-filters";
import { useReceivables } from "@/hooks/payments/use-payments";
import { AdminPerformanceCharts } from "./components/admin/performance-charts";
// import { AdminProductDistributionChart } from "./components/admin/product-distribution-chart";
import { AdminRevenueCharts } from "./components/admin/revenue-charts";
import { AdminStatGrid } from "./components/admin/stat-grid";
import { AdminStockAlertsTable } from "./components/admin/stock-alerts-table";
import { AdminStockSection } from "./components/admin/stock-section";
import { DashboardError, DashboardLoading } from "./components/admin/status";
import { DashboardPageHeader } from "./components/admin/page-header";
import { useAppStore } from "@/store/app";

export function AdminDashboard() {
  const billingEnabled = useAppStore((s) => s.user?.billingEnabled ?? false);
  const filters = useReportFilters();
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

      <AdminStatGrid
        summary={summary}
        comparison={comparison}
        billingEnabled={billingEnabled}
        outstandingBalance={outstandingBalance}
      />
      <AdminRevenueCharts charts={charts} />
      {/* <AdminProductDistributionChart filters={filters} /> */}
      <AdminPerformanceCharts charts={charts} />
      <AdminStockSection stockByCategory={charts.stockByCategory} recentSales={recentSales} />
      <AdminStockAlertsTable
        storeId={filters.query.storeId}
        lowStockCount={summary.lowStockCount}
        outOfStockCount={summary.outOfStockCount}
      />
    </>
  );
}
