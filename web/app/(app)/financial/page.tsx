"use client";

import { useMemo } from "react";
import {
  CreditCard,
  Download,
  Layers,
  Package,
  TrendingUp,
  Truck,
  XCircle,
} from "lucide-react";

import { PnlBreakdown } from "./components/pnl-breakdown";
import { GroupedBar } from "@/components/charts/grouped-bar";
import { LineArea } from "@/components/charts/line-area";
import { ReportFilterBar } from "@/components/filters/report-filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/app/(app)/dashboard/components/stat-card";
import { Card } from "@/components/ui/card";
import { useReportFilters } from "@/hooks/filters/use-report-filters";
import { useFinancialSummary } from "@/hooks/reports/use-financial-summary";
import { getLastSixMonthsRange } from "@/lib/filters/dates";
import { fmt } from "@/lib/utils";

const defaultRange = getLastSixMonthsRange();

export default function FinancialPage() {
  const filters = useReportFilters(defaultRange);
  const { data, isLoading, isError, error } = useFinancialSummary(filters.query);

  const revenueChart = useMemo(
    () =>
      (data?.charts.revenueCogsExpenses ?? []).map((row) => ({
        m: row.month,
        rev: row.revenue,
        cogs: row.cogs,
        exp: row.expenses,
      })),
    [data?.charts.revenueCogsExpenses],
  );

  const netProfitChart = useMemo(
    () => ({
      values: (data?.charts.netProfitTrend ?? []).map((row) => row.netProfit),
      labels: (data?.charts.netProfitTrend ?? []).map((row) => row.month),
    }),
    [data?.charts.netProfitTrend],
  );

  const header = (
    <PageHeader
      title="Financial Summary"
      desc="Revenue, cost, and profit for the selected period"
      action={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ReportFilterBar filters={filters} />
          <Button variant="outline" disabled>
            <Download className="size-4" />
            Export
          </Button>
        </div>
      }
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <div className="muted" style={{ padding: "24px 0" }}>
          Loading financial summary…
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        {header}
        <div className="alert-error" style={{ marginTop: 16 }}>
          <XCircle size={16} />
          {error instanceof Error
            ? error.message
            : "Failed to load financial summary."}
        </div>
      </>
    );
  }

  const { summary: s, breakdown } = data;

  return (
    <>
      {header}

      <div className="stat-grid grid-4 mb-16">
        <StatCard
          icon={TrendingUp}
          color="indigo"
          value={fmt(s.totalRevenue)}
          label="Total Revenue"
        />
        <StatCard
          icon={Package}
          color="violet"
          value={fmt(s.cogs)}
          label="Cost of Goods Sold"
          valueColor="var(--cost-slate)"
        />
        <StatCard
          icon={TrendingUp}
          color="teal"
          value={fmt(s.grossProfit)}
          label="Gross Profit"
        />
        <StatCard
          icon={CreditCard}
          color="amber"
          value={fmt(s.totalExpenses)}
          label="Total Expenses"
        />
        <StatCard
          icon={TrendingUp}
          color="violet"
          value={fmt(s.netProfit)}
          label="Net Profit"
        />
        <StatCard
          icon={Truck}
          color="indigo"
          value={fmt(s.stockInvestment)}
          label="Stock Capital Invested"
        />
        <StatCard
          icon={Layers}
          color="teal"
          value={fmt(s.currentStockValue)}
          label="Current Stock Value"
        />
      </div>

      <div className="mb-16">
        <PnlBreakdown breakdown={breakdown} />
      </div>

      <div className="grid-2">
        <Card title="Revenue vs COGS vs Expenses" pad>
          {revenueChart.length > 0 ? (
            <GroupedBar data={revenueChart} />
          ) : (
            <p className="muted" style={{ padding: "24px 0" }}>
              No sales or expenses in this period.
            </p>
          )}
        </Card>
        <Card title="Net Profit Trend" pad>
          {netProfitChart.values.length > 1 ? (
            <LineArea
              values={netProfitChart.values}
              labels={netProfitChart.labels}
            />
          ) : (
            <p className="muted" style={{ padding: "24px 0" }}>
              Not enough data for a trend chart.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
