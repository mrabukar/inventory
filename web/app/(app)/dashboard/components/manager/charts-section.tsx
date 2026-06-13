import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LineArea } from "@/components/charts/line-area";
import { Donut } from "@/components/charts/donut";
import type { ManagerDashboardCharts } from "@/types/reports/manager-dashboard";
import { DONUT_COLORS } from "../donut-colors";

interface Props {
  charts: ManagerDashboardCharts;
}

function thinDateLabels(dates: string[], step = 7): string[] {
  return dates.map((date, i) => {
    if (i === 0 || i === dates.length - 1 || i % step === 0) {
      return date.slice(5);
    }
    return "";
  });
}

export function ManagerChartsSection({ charts }: Props) {
  const { salesTrend, stockByCategory } = charts;

  const stockDonut = stockByCategory.map((row, i) => ({
    label: row.categoryName,
    value: row.units,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const stockTotal = stockByCategory.reduce((sum, row) => sum + row.units, 0);

  return (
    <div className="grid-2 mb-16">
      <Card title="Sales Trend (30 days)" pad>
        {salesTrend.length > 0 ? (
          <LineArea
            values={salesTrend.map((row) => row.revenue)}
            labels={thinDateLabels(salesTrend.map((row) => row.date))}
            height={200}
            color="var(--brand-indigo)"
            valueLabel="Revenue"
          />
        ) : (
          <EmptyState title="No sales trend" sub="No sales recorded in the last 30 days." />
        )}
      </Card>
      <Card title="Stock by Category" pad>
        {stockDonut.length > 0 ? (
          <Donut
            data={stockDonut}
            centerLabel="units"
            centerValue={stockTotal.toLocaleString()}
          />
        ) : (
          <EmptyState title="No stock data" sub="No inventory on hand at your store." />
        )}
      </Card>
    </div>
  );
}
