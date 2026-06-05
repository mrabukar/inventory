"use client";
import { useState } from "react";
import { CheckCircle2, Store, User } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Button }      from "@/components/ui/button";
import { Field }       from "@/components/ui/field";
import { useAppStore } from "@/store/app";
import { INVENTORY, PRODUCTS } from "@/lib/data";
import { fmt }         from "@/lib/utils";

interface Done { qty: number; product: string; total: number; }

export default function SubmitSalePage() {
  const user     = useAppStore((s) => s.user);
  const addToast = useAppStore((s) => s.addToast);
  const store    = user?.store ?? "";

  const stock    = INVENTORY.filter((i) => i.store === store && i.qty > 0);
  const products = PRODUCTS.filter((p) => p.active);

  const [pid,  setPid]  = useState("");
  const [qty,  setQty]  = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const inv   = stock.find((s) => s.product === pid);
  const prod  = products.find((p) => p.name === pid);
  const avail = inv?.qty ?? 0;
  const price = prod?.sell ?? 0;
  const q     = +qty || 0;
  const over  = q > avail;
  const total = q * price;

  const submit = () => {
    if (!pid || q < 1 || over) return;
    setDone({ qty: q, product: pid, total });
    addToast({ title: "Sale recorded successfully", sub: `${q} × ${pid} — ${fmt(total)}` });
    setPid(""); setQty(""); setNote("");
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <PageHeader title="Submit Sale" desc={store} />

      {done && (
        <div className="card card-pad mb-16" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--tint-emerald)", borderColor: "color-mix(in srgb, var(--status-emerald) 25%, transparent)" }}>
          <CheckCircle2 size={22} style={{ color: "var(--status-emerald)", flexShrink: 0 }} />
          <div style={{ fontSize: 14 }}>
            You recorded <b>{done.qty} × {done.product}</b> — <b>{fmt(done.total)}</b>
          </div>
        </div>
      )}

      <div className="card card-pad">
        <Field label="Product" required>
          <select value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Select a product…</option>
            {stock.map((s) => (
              <option key={s.id} value={s.product}>
                {s.product} · {s.cat} · {s.qty} available
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quantity" required error={over ? `Only ${avail} units available` : undefined}>
          <input
            className={`f-input${over ? " error" : ""}`}
            type="number" min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            disabled={!pid}
          />
        </Field>

        <Field label="Sale date" required>
          <input className="f-input" type="date" defaultValue={today} />
        </Field>

        <Field label="Note">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note about this sale" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "4px 0 14px" }}>
          <div className="readout"><Store size={15} />{store.split(" — ")[0]}</div>
          <div className="readout"><User size={15} />{user?.name}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--tint-indigo)", borderRadius: "var(--r-md)", marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "var(--fg2)" }}>
            {price ? `Price: ${fmt(price)} per unit` : "Select a product to see price"}
          </span>
          <span className="num" style={{ fontSize: 20, fontWeight: 700, color: "var(--brand-indigo)" }}>
            {fmt(total)}
          </span>
        </div>

        <Button variant="primary" size="lg" block onClick={submit} disabled={!pid || q < 1 || over}>
          Record Sale
        </Button>
      </div>
    </div>
  );
}
