"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader }    from "@/components/ui/page-header";
import { Button }        from "@/components/ui/button";
import { FilterBtn }     from "@/components/ui/search";
import { Sheet }         from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field }         from "@/components/ui/field";
import { Badge }         from "@/components/ui/badge";
import { EmptyState }    from "@/components/ui/empty-state";
import { SummaryBar }    from "@/components/ui/summary-bar";
import { useAppStore }   from "@/store/app";
import { EXPENSES, STORES } from "@/lib/data";
import { fmt }           from "@/lib/utils";
import type { Expense }  from "@/lib/types";

const CAT_COLOR: Record<string, string> = {
  Rent: "indigo", Salaries: "teal", Utilities: "violet",
  Logistics: "amber", Marketing: "emerald", Other: "slate",
};
const CATS = ["Rent", "Salaries", "Utilities", "Logistics", "Marketing", "Other"];

interface FormData { title: string; amount: string; cat: string; store: string; date: string; notes: string; }

function ExpenseSheet({ onClose, onSave }: { onClose: () => void; onSave: (d: FormData) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<FormData>({ title: "", amount: "", cat: "Rent", store: "Company-wide", date: today, notes: "" });
  const [err, setErr] = useState<Partial<FormData>>({});
  const set = (k: keyof FormData, v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    const e: Partial<FormData> = {};
    if (!f.title.trim()) e.title = "Title is required";
    if (!f.amount || +f.amount <= 0) e.amount = "Enter a positive amount";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave(f);
  };

  return (
    <Sheet
      title="Add Expense"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}
    >
      <Field label="Title" required error={err.title}>
        <input className={`f-input${err.title ? " error" : ""}`} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. June Electricity Bill" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Amount" required error={err.amount}>
          <input className={`f-input${err.amount ? " error" : ""}`} type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Category" required>
          <select value={f.cat} onChange={(e) => set("cat", e.target.value)}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Store">
        <select value={f.store} onChange={(e) => set("store", e.target.value)}>
          <option>Company-wide</option>
          {STORES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Expense date" required>
        <input className="f-input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" />
      </Field>
    </Sheet>
  );
}

export default function ExpensesPage() {
  const addToast = useAppStore((s) => s.addToast);
  const [rows, setRows] = useState<Expense[]>(EXPENSES.map((e) => ({ ...e })));
  const [sheet, setSheet] = useState(false);
  const [del,   setDel]   = useState<Expense | null>(null);

  const total = rows.reduce((a, e) => a + e.amount, 0);

  const add = (data: FormData) => {
    setRows((rs) => [{
      id: "e" + Date.now(), by: "Walaa A.", date: "Jun 05",
      store: data.store === "Company-wide" ? null : data.store,
      title: data.title, cat: data.cat, amount: +data.amount,
    }, ...rs]);
    setSheet(false);
    addToast({ title: "Expense added successfully" });
  };

  const remove = () => {
    if (!del) return;
    setRows((rs) => rs.filter((r) => r.id !== del.id));
    setDel(null);
    addToast({ title: "Expense deleted" });
  };

  return (
    <>
      <PageHeader
        title="Expenses"
        desc="Operating costs, company-wide and per store"
        action={<Button Icon={Plus} onClick={() => setSheet(true)}>Add Expense</Button>}
      />

      <div className="filterbar">
        <FilterBtn label="Last 30 days" />
        <FilterBtn label="All categories" />
        <FilterBtn label="All stores" />
      </div>

      <SummaryBar items={[
        { k: "Total Expenses", v: fmt(total), color: "var(--status-amber)" },
        { k: "Records",        v: `${rows.length} expenses` },
      ]} />

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Title</th><th>Category</th><th>Store</th>
              <th className="r">Amount</th><th>Created by</th><th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{r.date}</td>
                <td className="strong">{r.title}</td>
                <td><Badge color={(CAT_COLOR[r.cat] ?? "slate") as never}>{r.cat}</Badge></td>
                <td>{r.store ? r.store.split(" — ")[0] : <Badge color="slate">Company-wide</Badge>}</td>
                <td className="r num t-amber strong">{fmt(r.amount)}</td>
                <td className="muted">{r.by}</td>
                <td>
                  <div className="actions">
                    <button className="act-btn" title="Edit"><Pencil size={16} /></button>
                    <button className="act-btn danger" title="Delete" onClick={() => setDel(r)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <EmptyState title="No expenses found" sub="Add your first expense to get started." />}
      </div>

      {sheet && <ExpenseSheet onClose={() => setSheet(false)} onSave={add} />}
      {del && (
        <ConfirmDialog
          title="Delete expense?"
          message="This expense will be permanently deleted. This action cannot be undone."
          onConfirm={remove}
          onClose={() => setDel(null)}
        />
      )}
    </>
  );
}
