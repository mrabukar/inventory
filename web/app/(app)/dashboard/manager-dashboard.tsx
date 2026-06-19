"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import type { AppUser } from "@/lib/types";
import { getLastSixMonthsRange } from "@/lib/filters/dates";
import { useManagerDashboard } from "@/hooks/reports/manager-dashboard";
import { ReportExportMenu } from "@/components/reports/report-export-menu";
import { DashboardError, DashboardLoading } from "./components/admin/status";
import { ManagerChartsSection } from "./components/manager/charts-section";
import { ManagerRecentSalesTable } from "./components/manager/recent-sales-table";
import { ManagerStatGrid } from "./components/manager/stat-grid";
import { ManagerStockAlertsTable } from "./components/manager/stock-alerts-table";

export function ManagerDashboard({ user }: { user: AppUser }) {
  const label = user.store?.split(" — ")[0] ?? "My Store";
  const exportRange = getLastSixMonthsRange();
  const [exportBusy, setExportBusy] = useState(false);
  const { data, isLoading, isError, error } = useManagerDashboard();

  const header = (
    <PageHeader
      title={`Dashboard — ${label}`}
      desc="Your store at a glance"
      action={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ReportExportMenu
            report="financial-summary"
            params={exportRange}
            disabled={exportBusy}
            onBusyChange={setExportBusy}
          />
          <ReportExportMenu
            report="stock-report"
            params={exportRange}
            disabled={exportBusy}
            onBusyChange={setExportBusy}
          />
        </div>
      }
    />
  );

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
        <DashboardError
          message={error instanceof Error ? error.message : "Failed to load dashboard."}
        />
      </>
    );
  }

  const { summary, comparison, charts, recentSales } = data;

  return (
    <>
      {header}

      <ManagerStatGrid summary={summary} comparison={comparison} />
      <ManagerChartsSection charts={charts} />

      <ManagerRecentSalesTable sales={recentSales} />

      <ManagerStockAlertsTable
        lowStockCount={summary.lowStockCount}
        outOfStockCount={summary.outOfStockCount}
      />
    </>
  );
}
