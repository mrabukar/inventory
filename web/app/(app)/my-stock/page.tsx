"use client";
import { PageHeader }  from "@/components/ui/page-header";
import { FilterBtn, Search } from "@/components/ui/search";
import { SummaryBar }  from "@/components/ui/summary-bar";
import { CategoryBadge, StockBadge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app";
import { INVENTORY }   from "@/lib/data";

export default function MyStockPage() {
  const user  = useAppStore((s) => s.user);
  const store = user?.store ?? "";
  const label = store.split(" — ")[0];
  const rows  = INVENTORY.filter((i) => i.store === store);

  const totalUnits = rows.reduce((a, r) => a + r.qty, 0);
  const low        = rows.filter((r) => r.qty <= r.threshold).length;

  return (
    <>
      <PageHeader title={`My Stock — ${label}`} desc="Read-only view of your store's inventory" />

      <div className="filterbar">
        <FilterBtn label="All categories" />
        <FilterBtn label="All status" />
        <Search placeholder="Search product…" value="" onChange={() => {}} />
      </div>

      <SummaryBar items={[
        { k: "Total Products", v: rows.length },
        { k: "Total Units",    v: totalUnits  },
        { k: "Low Stock Items", v: low, color: low ? "var(--status-amber)" : undefined },
      ]} />

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Product</th><th>Category</th>
              <th className="r">Quantity</th><th className="r">Threshold</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="strong">{r.product}</td>
                <td><CategoryBadge cat={r.cat} /></td>
                <td className={`r num ${r.qty <= 0 ? "t-rose strong" : r.qty <= r.threshold ? "t-amber strong" : ""}`}>{r.qty}</td>
                <td className="r num muted">{r.threshold}</td>
                <td><StockBadge qty={r.qty} threshold={r.threshold} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
