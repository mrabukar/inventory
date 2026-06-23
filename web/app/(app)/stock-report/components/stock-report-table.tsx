import { Package, ShoppingCart, Truck } from "lucide-react";

import { StatCard } from "@/app/(app)/dashboard/components/stat-card";
import { toNumber } from "@/lib/reports/format";
import { fmt } from "@/lib/utils";
import type {
  StockReportProduct,
  StockReportTotals,
} from "@/types/reports/stock-report";

interface Props {
  totals: StockReportTotals;
  products: StockReportProduct[];
}

function formatUnits(value: number): string {
  return value.toLocaleString();
}

export function StockReportTable({ totals, products }: Props) {
  return (
    <div className="stock-report">
      <div className="stock-report-summary">
        <div className="stock-report-kpi stock-report-kpi--purchase">
          <StatCard
            icon={Truck}
            color="amber"
            value={formatUnits(totals.purchaseDevices)}
            label="Purchase devices"
          />
        </div>
        <div className="stock-report-kpi stock-report-kpi--instock">
          <StatCard
            icon={Package}
            color="teal"
            value={formatUnits(totals.inStock)}
            label="In stock (now)"
          />
        </div>
        <div className="stock-report-kpi stock-report-kpi--sales">
          <StatCard
            icon={ShoppingCart}
            color="indigo"
            value={formatUnits(totals.salesDevices)}
            label="Sales devices"
          />
        </div>
      </div>

      <div className="card stock-report-card">
        <div className="card-head">
          <h3>By product</h3>
          <span className="stock-report-meta">
            {products.length} product{products.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="stock-report-table-scroll">
          <table className="stock-report-table">
            <colgroup>
              <col className="stock-report-col-product" />
              <col className="stock-report-col-model" />
              <col className="stock-report-col-cost" />
              <col className="stock-report-col-num" />
              <col className="stock-report-col-num" />
              <col className="stock-report-col-num" />
            </colgroup>
            <thead>
              <tr className="stock-report-total-row">
                <th
                  scope="row"
                  className="stock-report-total-spacer"
                  aria-hidden="true"
                />
                <th
                  scope="row"
                  className="stock-report-total-spacer"
                  aria-hidden="true"
                />
                <th
                  scope="row"
                  className="stock-report-total-spacer"
                  aria-hidden="true"
                />
                <th className="stock-report-total-card stock-report-total-card--purchase">
                  {formatUnits(totals.purchaseDevices)}
                </th>
                <th className="stock-report-total-card stock-report-total-card--instock">
                  {formatUnits(totals.inStock)}
                </th>
                <th className="stock-report-total-card stock-report-total-card--sales">
                  {formatUnits(totals.salesDevices)}
                </th>
              </tr>
              <tr className="stock-report-columns-row">
                <th scope="col">Product</th>
                <th scope="col">Model</th>
                <th scope="col" className="stock-report-th-cost">
                  Avg unit cost
                </th>
                <th scope="col" className="stock-report-th-purchase">
                  Purchase count
                </th>
                <th scope="col" className="stock-report-th-instock">
                  In stock
                </th>
                <th scope="col" className="stock-report-th-sales">
                  Sales devices
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((row) => (
                <tr key={row.productId}>
                  <td className="stock-report-name">{row.productName}</td>
                  <td className="stock-report-model">
                    {row.productModel || "—"}
                  </td>
                  <td className="stock-report-cost">
                    {fmt(toNumber(row.averageCost))}
                  </td>
                  <td className="stock-report-num">
                    {formatUnits(row.purchaseDevices)}
                  </td>
                  <td className="stock-report-num stock-report-num-instock">
                    {formatUnits(row.inStock)}
                  </td>
                  <td className="stock-report-num stock-report-num-sales">
                    {formatUnits(row.salesDevices)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
