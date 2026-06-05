"use client";
import { Download, Eye } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Button }      from "@/components/ui/button";
import { FilterBtn, Search } from "@/components/ui/search";
import { SummaryBar }  from "@/components/ui/summary-bar";
import { CategoryBadge, SaleStatusBadge } from "@/components/ui/badge";
import { SALES }       from "@/lib/data";
import { fmt }         from "@/lib/utils";

export default function SalesPage() {
  const totalRev   = SALES.reduce((a, s) => a + s.qty * s.unit, 0);
  const totalUnits = SALES.reduce((a, s) => a + s.qty, 0);

  return (
    <>
      <PageHeader
        title="Sales"
        desc="Every recorded sale across all stores"
        action={<Button variant="outline" Icon={Download}>Export</Button>}
      />

      <div className="filterbar">
        <FilterBtn label="Last 30 days" />
        <FilterBtn label="All stores" />
        <FilterBtn label="All categories" />
        <Search placeholder="Search product…" value="" onChange={() => {}} />
      </div>

      <SummaryBar items={[
        { k: "Total Sales",   v: `${SALES.length} transactions` },
        { k: "Total Revenue", v: fmt(totalRev),  color: "var(--brand-indigo)" },
        { k: "Total Units",   v: `${totalUnits} sold` },
      ]} />

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Store</th><th>Product</th><th>Manager</th>
              <th className="r">Qty</th><th className="r">Unit Price</th>
              <th className="r">Total</th><th className="r">Profit</th>
              <th>Status</th><th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {SALES.map((r) => (
              <tr key={r.id}>
                <td className="muted">{r.date}</td>
                <td>{r.store.split(" — ")[0]}</td>
                <td><span className="strong">{r.product}</span>&nbsp;<CategoryBadge cat={r.cat} /></td>
                <td className="muted">{r.manager}</td>
                <td className="r num">{r.qty}</td>
                <td className="r num muted">{fmt(r.unit)}</td>
                <td className="r num t-indigo strong">{fmt(r.qty * r.unit)}</td>
                <td className={`r num ${r.profit >= 0 ? "t-emerald" : "t-rose"}`}>{fmt(r.profit)}</td>
                <td><SaleStatusBadge status={r.status} /></td>
                <td><div className="actions"><button className="act-btn" title="View"><Eye size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
