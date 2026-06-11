import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupedBar } from "@/components/charts/grouped-bar";
import { Donut } from "@/components/charts/donut";
import { DONUT_COLORS } from "../donut-colors";
import { fmtK } from "@/lib/utils";
import type { AdminDashboardCharts } from "@/types/reports/admin-dashboard";

interface Props {
  charts: AdminDashboardCharts;
}

export function AdminRevenueCharts({ charts }: Props) {
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
      <Card title="Revenue vs COGS vs Expenses" pad>
        {revenueChart.length > 0 ? (
          <GroupedBar data={revenueChart} />
        ) : (
          <EmptyState title="No sales data" sub="No revenue in the selected period." />
        )}
      </Card>
      <Card title="Expense Breakdown" pad>
        {expenseDonut.length > 0 ? (
          <Donut data={expenseDonut} centerLabel="Total" centerValue={fmtK(expenseTotal)} />
        ) : (
          <EmptyState title="No expenses" sub="No expenses recorded in the selected period." />
        )}
      </Card>
    </div>
  );
}
