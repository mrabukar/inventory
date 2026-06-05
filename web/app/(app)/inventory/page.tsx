"use client";
import { useState } from "react";
import { List, LayoutGrid, Store } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { FilterBtn }   from "@/components/ui/search";
import { CategoryBadge, StockBadge } from "@/components/ui/badge";
import { EmptyState }  from "@/components/ui/empty-state";
import { INVENTORY }   from "@/lib/data";
import { fmt }         from "@/lib/utils";

type StatusFilter = "All" | "Low" | "Out";

const fillColor = (qty: number, threshold: number) =>
  qty <= 0 ? "var(--status-rose)" : qty <= threshold ? "var(--status-amber)" : "var(--status-emerald)";

export default function InventoryPage() {
  const [view,   setView]   = useState<"table" | "grid">("table");
  const [status, setStatus] = useState<StatusFilter>("All");

  const rows = INVENTORY.filter((r) => {
    if (status === "All") return true;
    if (status === "Low") return r.qty > 0 && r.qty <= r.threshold;
    return r.qty <= 0;
  });

  return (
    <>
      <PageHeader title="Inventory" desc="Live stock levels per store" />

      <div className="filterbar">
        <FilterBtn label="All stores" />
        <FilterBtn label="All categories" />
        {(["All", "Low", "Out"] as StatusFilter[]).map((s) => (
          <FilterBtn
            key={s}
            label={s === "All" ? "All status" : s === "Low" ? "Low stock" : "Out of stock"}
            active={status === s}
            onClick={() => setStatus(s)}
          />
        ))}
        <span className="spacer" />
        <div className="view-toggle">
          <button className={view === "table" ? "vt-on" : ""} onClick={() => setView("table")} title="Table view">
            <List size={17} />
          </button>
          <button className={view === "grid" ? "vt-on" : ""} onClick={() => setView("grid")} title="Grid view">
            <LayoutGrid size={17} />
          </button>
        </div>
      </div>

      {view === "table" ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th><th>Store</th>
                <th className="r">Quantity</th><th className="r">Threshold</th>
                <th>Status</th><th className="r">Stock Value</th><th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><span className="strong">{r.product}</span>&nbsp;<CategoryBadge cat={r.cat} /></td>
                  <td className="muted">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Store size={13} />{r.store.split(" — ")[0]}
                    </span>
                  </td>
                  <td className={`r num ${r.qty <= 0 ? "t-rose strong" : r.qty <= r.threshold ? "t-amber strong" : ""}`}>{r.qty}</td>
                  <td className="r num muted">{r.threshold}</td>
                  <td><StockBadge qty={r.qty} threshold={r.threshold} /></td>
                  <td className="r num t-indigo">{fmt(r.qty * r.purchase)}</td>
                  <td className="muted">{r.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="No inventory records" sub="Try adjusting your filters." />}
        </div>
      ) : (
        <div className="inv-grid">
          {rows.map((r) => (
            <div className="inv-card" key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="ic-name">{r.product}</div>
                  <div className="ic-store"><Store size={13} />{r.store.split(" — ")[0]}</div>
                </div>
                <CategoryBadge cat={r.cat} />
              </div>
              <div className="ic-qty num" style={{ color: fillColor(r.qty, r.threshold) }}>{r.qty}</div>
              <div className="ic-prog">
                <div className="ic-fill" style={{ width: Math.min(100, (r.qty / (r.threshold * 3)) * 100) + "%", background: fillColor(r.qty, r.threshold) }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <StockBadge qty={r.qty} threshold={r.threshold} />
                <span className="num" style={{ fontSize: 12, color: "var(--fg3)" }}>thr {r.threshold}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
