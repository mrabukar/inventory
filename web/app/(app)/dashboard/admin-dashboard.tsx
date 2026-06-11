"use client";

import { useReportFilters } from "@/hooks/filters/use-report-filters";
import { useAdminDashboard } from "@/hooks/reports/admin-dashboard";
import { AdminPerformanceCharts } from "./components/admin/performance-charts";
import { AdminRevenueCharts } from "./components/admin/revenue-charts";
import { AdminStatGrid } from "./components/admin/stat-grid";
import { AdminStockAlertsCard } from "./components/admin/stock-alerts-card";
import { AdminStockSection } from "./components/admin/stock-section";
import { DashboardError, DashboardLoading } from "./components/admin/status";
import { DashboardPageHeader } from "./components/admin/page-header";

export function AdminDashboard() {
  const filters = useReportFilters();
  const { data, isLoading, isError, error } = useAdminDashboard(filters.query);

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

      <AdminStatGrid summary={summary} comparison={comparison} />
      <AdminRevenueCharts charts={charts} />
      <AdminPerformanceCharts charts={charts} />
      <AdminStockSection stockByCategory={charts.stockByCategory} recentSales={recentSales} />
      <AdminStockAlertsCard
        lowStockCount={summary.lowStockCount}
        outOfStockCount={summary.outOfStockCount}
      />
    </>
  );
}
