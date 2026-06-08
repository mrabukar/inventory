"use client";
import Link from "next/link";
import {
  TrendingUp, CreditCard, Layers, Package, AlertTriangle, ShoppingCart, XCircle,
} from "lucide-react";
import { PageHeader }   from "@/components/ui/page-header";
import { StatCard }     from "@/components/ui/stat-card";
import { Card }         from "@/components/ui/card";
import { FilterBtn }    from "@/components/ui/search";
import { EmptyState }   from "@/components/ui/empty-state";
import { GroupedBar }   from "@/components/charts/grouped-bar";
import { Donut }        from "@/components/charts/donut";
import { LineArea }     from "@/components/charts/line-area";
import { HBars }        from "@/components/charts/h-bars";
import { useAdminDashboard } from "@/hooks/reports/admin-dashboard";
import { formatExpenseTrend, formatPeriodTrend, formatSaleDate, toNumber } from "@/lib/reports/format";
import { fmt, fmtK } from "@/lib/utils";

const DONUT_COLORS = [
  "var(--brand-indigo)",
  "var(--brand-teal)",
  "var(--brand-violet)",
  "var(--status-amber)",
  "var(--status-rose)",
  "var(--status-emerald)",
];

export function AdminDashboard() {
  const { data, isLoading, isError, error } = useAdminDashboard();

  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" desc="Company-wide performance across all stores" />
        <div className="muted" style={{ padding: "24px 0" }}>Loading dashboard…</div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PageHeader title="Dashboard" desc="Company-wide performance across all stores" />
        <div className="alert-error" style={{ marginTop: 16 }}>
          <XCircle size={16} />
          {error instanceof Error ? error.message : "Failed to load dashboard."}
        </div>
      </>
    );
  }

  const { period, summary: s, comparison, charts, recentSales } = data;

  const revenueChart = charts.revenueCogsExpenses.map((row) => ({
    m: row.month,
    rev: row.revenue,
    cogs: row.cogs,
    exp: row.expenses,
  }));

  const expenseDonut = charts.expenseBreakdown.map((row, i) => ({
    label: row.categoryName,
    value: row.amount,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const stockDonut = charts.stockByCategory.map((row, i) => ({
    label: row.categoryName,
    value: row.units,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const expenseTotal = charts.expenseBreakdown.reduce((sum, row) => sum + row.amount, 0);
  const stockTotal = charts.stockByCategory.reduce((sum, row) => sum + row.units, 0);

  const periodLabel = `${period.from} → ${period.to}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        desc="Company-wide performance across all stores"
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <FilterBtn label={periodLabel} />
            <FilterBtn label="All stores" />
          </div>
        }
      />

      <div className="stat-grid grid-4 mb-16">
        <StatCard
          icon={TrendingUp}
          color="indigo"
          value={fmt(s.totalRevenue)}
          label="Total Revenue"
          {...formatPeriodTrend(comparison.totalRevenue)}
        />
        <StatCard
          icon={TrendingUp}
          color="teal"
          value={fmt(s.grossProfit)}
          label="Gross Profit"
          {...formatPeriodTrend(comparison.grossProfit)}
        />
        <StatCard
          icon={TrendingUp}
          color="violet"
          value={fmt(s.netProfit)}
          label="Net Profit"
          valueColor={s.netProfit < 0 ? "var(--status-rose)" : undefined}
          {...formatPeriodTrend(comparison.netProfit)}
        />
        <StatCard
          icon={CreditCard}
          color="amber"
          value={fmt(s.totalExpenses)}
          label="Total Expenses"
          {...formatExpenseTrend(comparison.totalExpenses)}
        />
        <StatCard icon={Layers} color="indigo" value={fmt(s.currentStockValue)} label="Current Stock Value" />
        <StatCard icon={Package} color="teal" value={s.inStockBalance.toLocaleString()} label="In-Stock Balance" />
        <StatCard icon={AlertTriangle} color="amber" value={s.lowStockCount} label="Low Stock Alerts" />
        <StatCard icon={AlertTriangle} color="rose" value={s.outOfStockCount} label="Out of Stock" />
        <StatCard
          icon={ShoppingCart}
          color="violet"
          value={s.totalUnitsSold.toLocaleString()}
          label="Units Sold"
          {...formatPeriodTrend(comparison.totalUnitsSold)}
        />
        <StatCard icon={CreditCard} color="indigo" value={fmt(s.cogs)} label="Cost of Goods Sold" />
      </div>

      <div className="dash-charts mb-16">
        <Card title="Revenue vs COGS vs Expenses" pad>
          {revenueChart.length > 0 ? (
            <GroupedBar data={revenueChart} />
          ) : (
            <EmptyState title="No sales data" sub="No revenue in the selected period." />
          )}
        </Card>
        <Card title="Expense Breakdown" pad>
          {expenseDonut.length > 0 ? (
            <Donut
              data={expenseDonut}
              centerLabel="Total"
              centerValue={fmtK(expenseTotal)}
            />
          ) : (
            <EmptyState title="No expenses" sub="No expenses recorded in the selected period." />
          )}
        </Card>
      </div>

      <div className="grid-3 mb-16">
        <Card title="Net Profit Trend" pad>
          {charts.netProfitTrend.length > 0 ? (
            <LineArea
              values={charts.netProfitTrend.map((row) => row.netProfit)}
              labels={charts.netProfitTrend.map((row) => row.month)}
              height={180}
            />
          ) : (
            <EmptyState title="No profit trend" sub="Not enough data for this period." />
          )}
        </Card>
        <Card title="Top Selling Products" pad>
          {charts.topProducts.length > 0 ? (
            <HBars
              data={charts.topProducts.map((row) => ({
                name: row.productName,
                units: row.unitsSold,
              }))}
              valueKey="units"
              labelKey="name"
              color="var(--brand-teal)"
            />
          ) : (
            <EmptyState title="No product sales" sub="No products sold in the selected period." />
          )}
        </Card>
        <Card title="Top Performing Stores" pad>
          {charts.topStores.length > 0 ? (
            <HBars
              data={charts.topStores.map((row) => ({
                name: row.storeName,
                revenue: row.revenue,
              }))}
              valueKey="revenue"
              labelKey="name"
              color="var(--brand-indigo)"
              format={fmtK}
            />
          ) : (
            <EmptyState title="No store rankings" sub="Store rankings appear when viewing all stores." />
          )}
        </Card>
      </div>

      <div className="grid-2 mb-16">
        <Card title="Stock by Category" pad>
          {stockDonut.length > 0 ? (
            <Donut
              data={stockDonut}
              centerLabel="Units"
              centerValue={stockTotal.toLocaleString()}
            />
          ) : (
            <EmptyState title="No stock data" sub="No inventory on hand for the current filters." />
          )}
        </Card>

        <Card title="Recent Sales" link="View all">
          {recentSales.length > 0 ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th><th>Store</th><th>Product</th>
                  <th className="r">Qty</th><th className="r">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.slice(0, 5).map((sale) => (
                  <tr key={sale.id}>
                    <td className="muted">{formatSaleDate(sale.saleDate)}</td>
                    <td>{sale.store.name}</td>
                    <td className="strong">{sale.product.name}</td>
                    <td className="r num">{sale.quantitySold}</td>
                    <td className="r num t-indigo strong">{fmt(toNumber(sale.totalAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No recent sales" sub="No sales recorded in the selected period." />
          )}
        </Card>
      </div>

      {(s.lowStockCount > 0 || s.outOfStockCount > 0) && (
        <Card title="Stock Alerts" titleIcon={AlertTriangle}>
          <p className="muted" style={{ marginBottom: 12 }}>
            {s.lowStockCount} low-stock and {s.outOfStockCount} out-of-stock items company-wide.
          </p>
          <Link href="/inventory" className="btn btn-outline btn-sm">
            View inventory alerts
          </Link>
        </Card>
      )}
    </>
  );
}
