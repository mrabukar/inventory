import { ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SaleStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/utils";
import type { Sale } from "@/lib/types";

interface Props {
  sales: Sale[];
}

export function ManagerRecentSalesTable({ sales }: Props) {
  return (
    <Card title="My Recent Sales">
      <table className="tbl">
        <thead>
          <tr>
            <th>Date</th>
            <th>Product</th>
            <th className="r">Qty</th>
            <th className="r">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sales.length ? (
            sales.map((row) => (
              <tr key={row.id}>
                <td className="muted">{row.date}</td>
                <td className="strong">{row.product}</td>
                <td className="r num">{row.qty}</td>
                <td className="r num t-indigo strong">{fmt(row.qty * row.unit)}</td>
                <td>
                  <SaleStatusBadge status={row.status} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>
                <EmptyState icon={ShoppingCart} title="No sales yet" sub="Submit your first sale to see it here." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
