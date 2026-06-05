"use client";
import {
  TrendingUp, CreditCard, Layers, Package, AlertTriangle, ShoppingCart, Truck, SquarePen, UserX,
} from "lucide-react";
import { PageHeader }   from "@/components/ui/page-header";
import { StatCard }     from "@/components/ui/stat-card";
import { Card }         from "@/components/ui/card";
import { FilterBtn }    from "@/components/ui/search";
import { Badge }        from "@/components/ui/badge";
import { GroupedBar }   from "@/components/charts/grouped-bar";
import { Donut }        from "@/components/charts/donut";
import { LineArea }     from "@/components/charts/line-area";
import { HBars }        from "@/components/charts/h-bars";
import {
  SUMMARY, REV_COGS_EXP, EXPENSE_BREAKDOWN, NET_PROFIT, MONTHS,
  TOP_PRODUCTS, TOP_STORES, SALES, INVENTORY, FEED,
} from "@/lib/data";
import { fmt, fmtK } from "@/lib/utils";

const COLOR_MAP: Record<string, string> = {
  indigo: "var(--brand-indigo)", teal: "var(--brand-teal)",
  amber: "var(--status-amber)", rose: "var(--status-rose)", violet: "var(--brand-violet)",
};
const TINT_MAP: Record<string, string> = {
  indigo: "var(--tint-indigo)", teal: "var(--tint-teal)",
  amber: "var(--tint-amber)", rose: "var(--tint-rose)", violet: "var(--tint-violet)",
};

export function AdminDashboard() {
  const s = SUMMARY;
  const lowStock = INVENTORY.filter((i) => i.qty <= i.threshold);

  return (
    <>
      <PageHeader
        title="Dashboard"
        desc="Company-wide performance across all stores"
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <FilterBtn label="Last 6 months" />
            <FilterBtn label="All stores" />
          </div>
        }
      />

      {/* Stat cards */}
      <div className="stat-grid grid-4 mb-16">
        <StatCard icon={TrendingUp}    color="indigo"  value={fmt(s.total_revenue)}       label="Total Revenue"      trend="12.4%" />
        <StatCard icon={TrendingUp}    color="teal"    value={fmt(s.gross_profit)}         label="Gross Profit"       trend="6.1%"  />
        <StatCard icon={TrendingUp}    color="violet"  value={fmt(s.net_profit)}           label="Net Profit"         trend="8.1%"  />
        <StatCard icon={CreditCard}    color="amber"   value={fmt(s.total_expenses)}       label="Total Expenses"     trend="2.0%"  trendDir="down" />
        <StatCard icon={Layers}        color="indigo"  value={fmt(s.current_stock_value)}  label="Current Stock Value" />
        <StatCard icon={Package}       color="teal"    value={s.in_stock_balance.toLocaleString()} label="In-Stock Balance" />
        <StatCard icon={AlertTriangle} color="amber"   value={s.low_stock_count}           label="Low Stock Alerts"   />
        <StatCard icon={ShoppingCart}  color="violet"  value={s.units_sold}                label="Units Sold"         />
      </div>

      {/* Charts row */}
      <div className="dash-charts mb-16">
        <Card title="Revenue vs COGS vs Expenses" pad>
          <GroupedBar data={REV_COGS_EXP} />
        </Card>
        <Card title="Expense Breakdown" pad>
          <Donut
            data={EXPENSE_BREAKDOWN}
            centerLabel="Total"
            centerValue={fmtK(EXPENSE_BREAKDOWN.reduce((a, b) => a + b.value, 0))}
          />
        </Card>
      </div>

      {/* Second charts row */}
      <div className="grid-3 mb-16">
        <Card title="Net Profit Trend" pad>
          <LineArea values={NET_PROFIT} labels={MONTHS} height={180} />
        </Card>
        <Card title="Top Selling Products" pad>
          <HBars data={TOP_PRODUCTS} valueKey="units" labelKey="name" color="var(--brand-teal)" />
        </Card>
        <Card title="Top Performing Stores" pad>
          <HBars data={TOP_STORES} valueKey="rev" labelKey="name" color="var(--brand-indigo)" format={fmtK} />
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid-2 mb-16">
        <Card title="Recent Sales" link="View all">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Store</th><th>Product</th>
                <th className="r">Qty</th><th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {SALES.slice(0, 5).map((r) => (
                <tr key={r.id}>
                  <td className="muted">{r.date}</td>
                  <td>{r.store.split(" — ")[0]}</td>
                  <td className="strong">{r.product}</td>
                  <td className="r num">{r.qty}</td>
                  <td className="r num t-indigo strong">{fmt(r.qty * r.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Low Stock Alerts" titleIcon={AlertTriangle}>
          <table className="tbl">
            <thead>
              <tr><th>Product</th><th>Store</th><th className="r">Qty</th><th className="r">Threshold</th></tr>
            </thead>
            <tbody>
              {lowStock.map((r) => (
                <tr key={r.id}>
                  <td className="strong">{r.product}</td>
                  <td className="muted">{r.store.split(" — ")[0]}</td>
                  <td className="r num t-rose strong">{r.qty}</td>
                  <td className="r num muted">{r.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Activity feed */}
      <Card title="Recent Activity" link="View full audit log" pad>
        {FEED.map((f, i) => (
          <div className="feed-item" key={i}>
            <div className="feed-ic" style={{ background: TINT_MAP[f.color], color: COLOR_MAP[f.color] }}>
              {f.icon === "Truck"        && <Truck size={16} />}
              {f.icon === "ShoppingCart" && <ShoppingCart size={16} />}
              {f.icon === "CreditCard"   && <CreditCard size={16} />}
              {f.icon === "SquarePen"    && <SquarePen size={16} />}
              {f.icon === "UserX"        && <UserX size={16} />}
            </div>
            <div>
              <div className="feed-text" dangerouslySetInnerHTML={{ __html: f.text }} />
              <div className="feed-time">{f.time}</div>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
