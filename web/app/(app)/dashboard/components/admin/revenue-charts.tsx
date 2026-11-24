import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupedBar } from "@/components/charts/grouped-bar";
import { Donut } from "@/components/charts/donut";
import { DONUT_COLORS } from "../donut-colors";
import { fmt } from "@/lib/utils";
import type { AdminDashboardCharts } from "@/types/reports/admin-dashboard";

interface Props {
  charts: AdminDashboardCharts;
  /** Looking at a credit branch: revenue only, no cost or expenses. */
  branchView?: boolean;
}

export function AdminRevenueCharts({ charts, branchView = false }: Props) {
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

  const expenseTotal = charts.expenseBreakdown.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="dash-charts mb-16">
      {/* A branch has no expense card beside it, so the revenue card takes the full row. */}
      <div style={branchView ? { gridColumn: "1 / -1" } : undefined}>
        <Card title={branchView ? "Revenue" : "Revenue vs COGS vs Expenses"} pad>
          {revenueChart.length > 0 ? (
            <GroupedBar
              data={revenueChart}
              showExpenses={!branchView}
              showCogs={!branchView}
            />
          ) : (
            <EmptyState title="No sales data" sub="No revenue in the selected period." />
          )}
        </Card>
      </div>
      {branchView ? null : (
        <Card title="Expense Breakdown" pad>
          {expenseDonut.length > 0 ? (
            <Donut data={expenseDonut} centerLabel="Total" centerValue={fmt(expenseTotal)} />
          ) : (
            <EmptyState title="No expenses" sub="No expenses recorded in the selected period." />
          )}
        </Card>
      )}
    </div>
  );
}
