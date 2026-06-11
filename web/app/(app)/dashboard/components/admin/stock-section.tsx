import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Donut } from "@/components/charts/donut";
import { AdminRecentSalesTable } from "./recent-sales-table";
import { DONUT_COLORS } from "../donut-colors";
import type { AdminDashboardCharts, DashboardRecentSale } from "@/types/reports/admin-dashboard";

interface Props {
  stockByCategory: AdminDashboardCharts["stockByCategory"];
  recentSales: DashboardRecentSale[];
}

export function AdminStockSection({ stockByCategory, recentSales }: Props) {
  const stockDonut = stockByCategory.map((row, i) => ({
    label: row.categoryName,
    value: row.units,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const stockTotal = stockByCategory.reduce((sum, row) => sum + row.units, 0);

  return (
    <div className="grid-2 mb-16">
      <Card title="Stock by Category" pad>
        {stockDonut.length > 0 ? (
          <Donut data={stockDonut} centerLabel="Units" centerValue={stockTotal.toLocaleString()} />
        ) : (
          <EmptyState title="No stock data" sub="No inventory on hand for the current filters." />
        )}
      </Card>

      <Card title="Recent Sales" link="View all">
        <AdminRecentSalesTable sales={recentSales} />
      </Card>
    </div>
  );
}
