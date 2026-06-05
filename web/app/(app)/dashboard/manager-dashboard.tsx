"use client";
import { ShoppingCart, TrendingUp, Package, AlertTriangle } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { StatCard }    from "@/components/ui/stat-card";
import { Card }        from "@/components/ui/card";
import { Badge, CategoryBadge, StockBadge, SaleStatusBadge } from "@/components/ui/badge";
import { EmptyState }  from "@/components/ui/empty-state";
import { LineArea }    from "@/components/charts/line-area";
import { Donut }       from "@/components/charts/donut";
import { INVENTORY, SALES } from "@/lib/data";
import { fmt } from "@/lib/utils";
import type { AppUser } from "@/lib/types";

export function ManagerDashboard({ user }: { user: AppUser }) {
  const store  = user.store ?? "";
  const label  = store.split(" — ")[0];
  const myStock = INVENTORY.filter((i) => i.store === store);
  const mySales = SALES.filter((s) => s.store === store);

  const mobiles = myStock.filter((i) => i.cat === "Mobiles").reduce((a, b) => a + b.qty, 0);
  const acc     = myStock.filter((i) => i.cat === "Accessories").reduce((a, b) => a + b.qty, 0);
  const lowCount = myStock.filter((i) => i.qty <= i.threshold).length;

  return (
    <>
      <PageHeader title={`Dashboard — ${label}`} desc="Your store at a glance" />

      <div className="stat-grid grid-4 mb-16">
        <StatCard icon={ShoppingCart}  color="indigo"  value="$3,216"        label="Today's Sales"    trend="4.2%" />
        <StatCard icon={TrendingUp}    color="teal"    value="$27,500"       label="This Month Sales" trend="9.0%" />
        <StatCard icon={Package}       color="violet"  value={mobiles + acc} label="In-Stock Balance" />
        <StatCard icon={AlertTriangle} color="amber"   value={lowCount}      label="Low Stock Items"  />
      </div>

      <div className="grid-2 mb-16">
        <Card title="Sales Trend (30 days)" pad>
          <LineArea
            values={[820, 1100, 640, 1340, 980, 1620, 1210]}
            labels={["W1", "", "W2", "", "W3", "", "W4"]}
            height={200}
            color="var(--brand-indigo)"
          />
        </Card>
        <Card title="Stock by Category" pad>
          <Donut
            data={[
              { label: "Mobiles",     value: mobiles || 1, color: "var(--brand-indigo)" },
              { label: "Accessories", value: acc || 1,     color: "var(--brand-teal)"   },
            ]}
            centerLabel="units"
            centerValue={mobiles + acc}
          />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="My Recent Sales">
          <table className="tbl">
            <thead>
              <tr><th>Date</th><th>Product</th><th className="r">Qty</th><th className="r">Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {mySales.length ? mySales.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{r.date}</td>
                  <td className="strong">{r.product}</td>
                  <td className="r num">{r.qty}</td>
                  <td className="r num t-indigo strong">{fmt(r.qty * r.unit)}</td>
                  <td><SaleStatusBadge status={r.status} /></td>
                </tr>
              )) : (
                <tr><td colSpan={5}>
                  <EmptyState icon={ShoppingCart} title="No sales yet" sub="Submit your first sale to see it here." />
                </td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="My Stock Levels">
          <table className="tbl">
            <thead>
              <tr><th>Product</th><th>Category</th><th className="r">Qty</th><th>Status</th></tr>
            </thead>
            <tbody>
              {myStock.map((r) => (
                <tr key={r.id}>
                  <td className="strong">{r.product}</td>
                  <td><CategoryBadge cat={r.cat} /></td>
                  <td className={`r num ${r.qty <= 0 ? "t-rose" : r.qty <= r.threshold ? "t-amber" : ""}`}>{r.qty}</td>
                  <td><StockBadge qty={r.qty} threshold={r.threshold} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
