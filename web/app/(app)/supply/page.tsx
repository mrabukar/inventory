"use client";
import { Plus, Eye } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Button }      from "@/components/ui/button";
import { FilterBtn, Search } from "@/components/ui/search";
import { CategoryBadge, Badge } from "@/components/ui/badge";
import { SUPPLY }      from "@/lib/data";
import { fmt }         from "@/lib/utils";

export default function SupplyPage() {
  return (
    <>
      <PageHeader
        title="Stock Supply"
        desc="Inbound stock to each store"
        action={<Button Icon={Plus}>New Supply</Button>}
      />

      <div className="filterbar">
        <FilterBtn label="Last 30 days" />
        <FilterBtn label="All stores" />
        <Search placeholder="Search product…" value="" onChange={() => {}} />
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Product</th><th>Store</th>
              <th className="r">Qty</th><th className="r">Unit Cost</th>
              <th className="r">Total Investment</th><th>Supplied by</th><th>Note</th>
            </tr>
          </thead>
          <tbody>
            {SUPPLY.map((r) => (
              <tr key={r.id}>
                <td className="muted">{r.date}</td>
                <td><span className="strong">{r.product}</span>&nbsp;<CategoryBadge cat={r.cat} /></td>
                <td>{r.store.split(" — ")[0]}</td>
                <td className={`r num ${r.qty < 0 ? "t-rose strong" : ""}`}>
                  {r.qty < 0 ? r.qty : "+" + r.qty}
                  {r.qty < 0 && <>&nbsp;<Badge color="amber">Correction</Badge></>}
                </td>
                <td className="r num muted">{fmt(r.unit)}</td>
                <td className="r num t-indigo">{fmt(Math.abs(r.qty) * r.unit)}</td>
                <td className="muted">{r.by}</td>
                <td className="muted">
                  {r.note
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {r.note.length > 20 ? r.note.slice(0, 20) + "…" : r.note}
                        <Eye size={13} />
                      </span>
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
