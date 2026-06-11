import { EmptyState } from "@/components/ui/empty-state";
import { formatSaleDate, toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type { DashboardRecentSale } from "@/types/reports/admin-dashboard";

interface Props {
  sales: DashboardRecentSale[];
}

export function AdminRecentSalesTable({ sales }: Props) {
  if (sales.length === 0) {
    return <EmptyState title="No recent sales" sub="No sales recorded in the selected period." />;
  }

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Date</th>
          <th>Store</th>
          <th>Product</th>
          <th className="r">Qty</th>
          <th className="r">Amount</th>
        </tr>
      </thead>
      <tbody>
        {sales.slice(0, 5).map((sale) => (
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
  );
}
