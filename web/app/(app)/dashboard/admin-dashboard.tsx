"use client";

import { useEffect } from "react";

import { useCategories } from "@/hooks/categories/use-categories";
import { useReportFilters } from "@/hooks/filters/use-report-filters";
import { useAdminDashboard } from "@/hooks/reports/admin-dashboard";
import { AdminPerformanceCharts } from "./components/admin/performance-charts";
import { AdminProductDistributionChart } from "./components/admin/product-distribution-chart";
import { AdminRevenueCharts } from "./components/admin/revenue-charts";
import { AdminStatGrid } from "./components/admin/stat-grid";
import { AdminStockAlertsTable } from "./components/admin/stock-alerts-table";
import { AdminStockSection } from "./components/admin/stock-section";
import { DashboardError, DashboardLoading } from "./components/admin/status";
import { DashboardPageHeader } from "./components/admin/page-header";

export function AdminDashboard() {
  const filters = useReportFilters();
  const { data: categories = [] } = useCategories();
  const { data, isLoading, isError, error } = useAdminDashboard(filters.query);

  useEffect(() => {
    if (categories.length > 0 && filters.query.categoryId == null) {
      filters.setCategoryId(categories[0].id);
    }
  }, [categories, filters.query.categoryId, filters.setCategoryId]);

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
      <AdminProductDistributionChart filters={filters} />
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
