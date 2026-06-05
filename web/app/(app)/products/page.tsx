"use client";
import { useState, useMemo } from "react";
import { Plus, Pencil, PowerOff, Power } from "lucide-react";
import { PageHeader }    from "@/components/ui/page-header";
import { Button }        from "@/components/ui/button";
import { Search, FilterBtn } from "@/components/ui/search";
import { Sheet }         from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field }         from "@/components/ui/field";
import { Badge, CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState }    from "@/components/ui/empty-state";
import { useAppStore }   from "@/store/app";
import { PRODUCTS }      from "@/lib/data";
import { fmt }           from "@/lib/utils";
import type { Product }  from "@/lib/types";

const margin = (p: Product) => Math.round(((p.sell - p.purchase) / p.purchase) * 100);

interface SheetState { mode: "add" | "edit"; row?: Product; }
type FormData = { name: string; cat: string; desc: string; purchase: string; sell: string; };

function ProductSheet({ initial, onClose, onSave }: { initial?: Product; onClose: () => void; onSave: (d: FormData) => void }) {
  const [f, setF] = useState<FormData>({
    name: initial?.name ?? "", cat: initial?.cat ?? "Mobiles",
    desc: initial?.desc ?? "", purchase: String(initial?.purchase ?? ""), sell: String(initial?.sell ?? ""),
  });
  const [err, setErr] = useState<Partial<FormData>>({});
  const set = (k: keyof FormData, v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    const e: Partial<FormData> = {};
    if (!f.name.trim()) e.name = "Name is required";
    if (!f.purchase || +f.purchase <= 0) e.purchase = "Enter a purchase price";
    if (!f.sell || +f.sell <= 0) e.sell = "Enter a selling price";
    else if (+f.sell < +f.purchase) e.sell = "Selling price must be ≥ purchase price";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave(f);
  };

  return (
    <Sheet
      title={initial ? "Edit Product" : "Add Product"}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}
    >
      <Field label="Product name" required error={err.name}>
        <input className={`f-input${err.name ? " error" : ""}`} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. iPhone 15" />
      </Field>
      <Field label="Category" required>
        <select value={f.cat} onChange={(e) => set("cat", e.target.value)}>
          <option>Mobiles</option><option>Accessories</option>
        </select>
      </Field>
      <Field label="Description">
        <textarea value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Optional description" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Purchase price" required error={err.purchase}>
          <input className={`f-input${err.purchase ? " error" : ""}`} type="number" value={f.purchase} onChange={(e) => set("purchase", e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Selling price" required error={err.sell}>
          <input className={`f-input${err.sell ? " error" : ""}`} type="number" value={f.sell} onChange={(e) => set("sell", e.target.value)} placeholder="0.00" />
        </Field>
      </div>
    </Sheet>
  );
}

export default function ProductsPage() {
  const addToast = useAppStore((s) => s.addToast);
  const [rows, setRows] = useState<Product[]>(PRODUCTS.map((p) => ({ ...p })));
  const [q,    setQ]    = useState("");
  const [cat,  setCat]  = useState("All");
  const [sheet,   setSheet]   = useState<SheetState | null>(null);
  const [confirm, setConfirm] = useState<Product | null>(null);

  const filtered = useMemo(
    () => rows.filter((r) => (cat === "All" || r.cat === cat) && r.name.toLowerCase().includes(q.toLowerCase())),
    [rows, q, cat]
  );

  const save = (data: FormData) => {
    if (sheet?.row) {
      setRows((rs) => rs.map((r) => r.id === sheet.row!.id ? { ...r, ...data, purchase: +data.purchase, sell: +data.sell } : r));
      addToast({ title: "Product updated" });
    } else {
      setRows((rs) => [{ id: "p" + Date.now(), active: true, by: "Walaa A.", ...data, purchase: +data.purchase, sell: +data.sell }, ...rs]);
      addToast({ title: "Product added successfully" });
    }
    setSheet(null);
  };

  const toggleActive = (r: Product) => {
    setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, active: !x.active } : x));
    setConfirm(null);
    addToast({ title: r.active ? "Product deactivated" : "Product reactivated" });
  };

  return (
    <>
      <PageHeader
        title="Products"
        desc="Your product catalog across all stores"
        action={<Button Icon={Plus} onClick={() => setSheet({ mode: "add" })}>Add Product</Button>}
      />

      <div className="filterbar">
        <Search placeholder="Search products…" value={q} onChange={setQ} />
        {["All", "Mobiles", "Accessories"].map((c) => (
          <FilterBtn key={c} label={c} active={cat === c} onClick={() => setCat(c)} />
        ))}
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th><th>Category</th>
              <th className="r">Purchase</th><th className="r">Selling</th><th className="r">Margin</th>
              <th>Status</th><th>Created by</th><th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="strong">{r.name}</td>
                <td><CategoryBadge cat={r.cat} /></td>
                <td className="r num muted">{fmt(r.purchase)}</td>
                <td className="r num strong">{fmt(r.sell)}</td>
                <td className="r num t-emerald">{margin(r)}%</td>
                <td><StatusBadge active={r.active} /></td>
                <td className="muted">{r.by}</td>
                <td>
                  <div className="actions">
                    <button className="act-btn" title="Edit" onClick={() => setSheet({ mode: "edit", row: r })}>
                      <Pencil size={16} />
                    </button>
                    <button className={`act-btn${r.active ? " danger" : ""}`} title={r.active ? "Deactivate" : "Reactivate"} onClick={() => setConfirm(r)}>
                      {r.active ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <EmptyState icon={Plus} title="No products found" sub="Try adjusting your filters." />}
      </div>

      {sheet && <ProductSheet initial={sheet.row} onClose={() => setSheet(null)} onSave={save} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.active ? "Deactivate product?" : "Reactivate product?"}
          message={confirm.active
            ? "This product will be hidden from sales forms. Historical records are preserved."
            : "This product will appear in sales forms again."}
          confirmLabel={confirm.active ? "Deactivate" : "Reactivate"}
          variant={confirm.active ? "danger" : "primary"}
          onConfirm={() => toggleActive(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
