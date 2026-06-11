import { CategoryBadge, StockBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { InventoryRow } from "@/lib/types";

interface Props {
  stock: InventoryRow[];
}

export function ManagerStockLevelsTable({ stock }: Props) {
  return (
    <Card title="My Stock Levels">
      <table className="tbl">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th className="r">Qty</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((row) => (
            <tr key={row.id}>
              <td className="strong">{row.product}</td>
              <td>
                <CategoryBadge cat={row.cat} />
              </td>
              <td
                className={`r num ${row.qty <= 0 ? "t-rose" : row.qty <= row.threshold ? "t-amber" : ""}`}
              >
                {row.qty}
              </td>
              <td>
                <StockBadge qty={row.qty} threshold={row.threshold} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
