import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LineArea } from "@/components/charts/line-area";
import { HBars } from "@/components/charts/h-bars";
import { fmtK } from "@/lib/utils";
import type { AdminDashboardCharts } from "@/types/reports/admin-dashboard";

interface Props {
  charts: AdminDashboardCharts;
}

export function AdminPerformanceCharts({ charts }: Props) {
  return (
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
  );
}
