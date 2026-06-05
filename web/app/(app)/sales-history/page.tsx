"use client";
import { useState } from "react";
import { SquarePen, History } from "lucide-react";
import { PageHeader }    from "@/components/ui/page-header";
import { FilterBtn, Search } from "@/components/ui/search";
import { Sheet }         from "@/components/ui/sheet";
import { Field }         from "@/components/ui/field";
import { Button }        from "@/components/ui/button";
import { CategoryBadge, SaleStatusBadge } from "@/components/ui/badge";
import { EmptyState }    from "@/components/ui/empty-state";
import { useAppStore }   from "@/store/app";
import { SALES }         from "@/lib/data";
import { fmt }           from "@/lib/utils";
import type { Sale }     from "@/lib/types";

function CorrectionSheet({ sale, onClose, onSave }: { sale: Sale; onClose: () => void; onSave: (s: Sale, qty: number) => void }) {
  const [qty, setQty]       = useState(String(sale.qty));
  const [reason, setReason] = useState("");
  const [err, setErr]       = useState<{ qty?: string; reason?: string }>({});

  const save = () => {
    const e: typeof err = {};
    if (!qty || +qty < 0) e.qty = "Enter a valid quantity";
    if (!reason.trim())   e.reason = "Reason is required";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave(sale, +qty);
  };

  return (
    <Sheet
      title="Correct Sale"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Submit Correction</Button></>}
    >
      <div className="readout" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6, marginBottom: 18 }}>
        <div><b>{sale.product}</b></div>
        <div>Original quantity: <b>{sale.qty}</b></div>
        <div>Sale date: {sale.date}</div>
      </div>
      <Field label="Corrected quantity" required error={err.qty}>
        <input className={`f-input${err.qty ? " error" : ""}`} type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
      </Field>
      <Field label="Reason" required error={err.reason}>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this sale is being corrected" />
      </Field>
    </Sheet>
  );
}

export default function SalesHistoryPage() {
  const user     = useAppStore((s) => s.user);
  const addToast = useAppStore((s) => s.addToast);
  const store    = user?.store ?? "";

  const [rows,    setRows]    = useState<Sale[]>(SALES.filter((s) => s.store === store).map((s) => ({ ...s })));
  const [correct, setCorrect] = useState<Sale | null>(null);

  const doCorrect = (sale: Sale, newQty: number) => {
    setRows((rs) => rs.map((r) => r.id === sale.id ? { ...r, qty: newQty, status: "corrected" } : r));
    setCorrect(null);
    addToast({ title: "Sale corrected", sub: `${sale.product} → ${newQty} units` });
  };

  return (
    <>
      <PageHeader title="Sales History" desc="Your submitted sales" />

      <div className="filterbar">
        <FilterBtn label="Last 30 days" />
        <Search placeholder="Search product…" value="" onChange={() => {}} />
        <FilterBtn label="All status" />
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Product</th>
              <th className="r">Qty</th><th className="r">Unit Price</th><th className="r">Total</th>
              <th>Status</th><th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{r.date}</td>
                <td><span className="strong">{r.product}</span>&nbsp;<CategoryBadge cat={r.cat} /></td>
                <td className="r num">{r.qty}</td>
                <td className="r num muted">{fmt(r.unit)}</td>
                <td className="r num t-indigo strong">{fmt(r.qty * r.unit)}</td>
                <td><SaleStatusBadge status={r.status} /></td>
                <td>
                  <div className="actions">
                    <button
                      className="act-btn"
                      title="Correct"
                      disabled={r.status === "corrected"}
                      style={r.status === "corrected" ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
                      onClick={() => r.status !== "corrected" && setCorrect(r)}
                    >
                      <SquarePen size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7}>
                <EmptyState icon={History} title="No sales yet" sub="Your submitted sales will appear here." />
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {correct && <CorrectionSheet sale={correct} onClose={() => setCorrect(null)} onSave={doCorrect} />}
    </>
  );
}
