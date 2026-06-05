"use client";
import { useState, useEffect } from "react";
import { Eye, X } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { FilterBtn }   from "@/components/ui/search";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Button }      from "@/components/ui/button";
import { AUDIT }       from "@/lib/data";
import type { AuditRow } from "@/lib/types";

const ACTION_C: Record<string, string> = {
  SALE_CREATED: "teal", STOCK_SUPPLIED: "indigo", EXPENSE_CREATED: "amber",
  SALE_CORRECTED: "rose", USER_DEACTIVATED: "violet", PRODUCT_UPDATED: "slate",
};

function diffVal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return '"' + v + '"';
  return String(v);
}

function buildDiff(before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const out: { g: string; t: string }[] = [];
  out.push({ g: " ", t: "{" });
  if (!before) {
    Object.entries(after).forEach(([k, v], i, arr) =>
      out.push({ g: "+", t: `  "${k}": ${diffVal(v)}${i < arr.length - 1 ? "," : ""}` })
    );
  } else {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    keys.forEach((k, i) => {
      const comma = i < keys.length - 1 ? "," : "";
      const inB = k in before, inA = k in after;
      if (inB && inA && before[k] === after[k]) { out.push({ g: " ", t: `  "${k}": ${diffVal(after[k])}${comma}` }); }
      else if (inB && inA) {
        out.push({ g: "-", t: `  "${k}": ${diffVal(before[k])}${comma}` });
        out.push({ g: "+", t: `  "${k}": ${diffVal(after[k])}${comma}` });
      } else if (inA) { out.push({ g: "+", t: `  "${k}": ${diffVal(after[k])}${comma}` }); }
      else { out.push({ g: "-", t: `  "${k}": ${diffVal(before[k])}${comma}` }); }
    });
  }
  out.push({ g: " ", t: "}" });
  return out;
}

function AuditModal({ row, onClose }: { row: AuditRow; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const lines = buildDiff(row.before, row.after);
  const isCreate = !row.before;
  const meta = [
    { k: "Timestamp", v: row.ts },
    { k: "Entity",    v: <span className="num">{row.entity}</span> },
    { k: "User",      v: <><span className="strong">{row.user}</span>&nbsp;<RoleBadge role={row.role} /></> },
    { k: "Store",     v: row.store },
    { k: "Source",    v: <span className="num">{row.source}</span> },
    { k: "Action",    v: <Badge color={(ACTION_C[row.action] ?? "slate") as never}>{row.action}</Badge> },
  ];

  return (
    <div className="dialog audit-dialog">
      <div className="overlay" onClick={onClose} />
      <div className="dialog-box">
        <div className="audit-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Badge color={(ACTION_C[row.action] ?? "slate") as never}>{row.action}</Badge>
              <span className="num audit-entity">{row.entity}</span>
            </div>
            <p className="audit-sum">{row.summary}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="audit-meta">
          {meta.map((m, i) => (
            <div className="audit-m" key={i}>
              <div className="audit-mk">{m.k}</div>
              <div className="audit-mv">{m.v}</div>
            </div>
          ))}
        </div>
        <div className="diff-head">
          <span className="dh-label">{isCreate ? "Record created" : "Field changes"}</span>
          <span className="diff-legend">
            <span><i className="add" />added</span>
            {!isCreate && <span><i className="rem" />removed</span>}
          </span>
        </div>
        <div className="diff">
          {lines.map((l, i) => (
            <div className={`dl ${l.g === "+" ? "add" : l.g === "-" ? "rem" : ""}`} key={i}>
              <span className="dg">{l.g === "+" ? "+" : l.g === "-" ? "−" : " "}</span>
              <span className="dc">{l.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuditPage() {
  const [sel, setSel] = useState<AuditRow | null>(null);

  return (
    <>
      <PageHeader title="Audit Log" desc="Every action, who did it, and when" />

      <div className="filterbar">
        <FilterBtn label="Last 7 days" />
        <FilterBtn label="All users" />
        <FilterBtn label="All actions" />
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Timestamp</th><th>User</th><th>Action</th>
              <th>Entity</th><th>Summary</th><th className="r">Detail</th>
            </tr>
          </thead>
          <tbody>
            {AUDIT.map((r) => (
              <tr key={r.id}>
                <td className="num muted" style={{ fontSize: 13 }}>{r.ts}</td>
                <td><span className="strong">{r.user}</span>&nbsp;<RoleBadge role={r.role} /></td>
                <td><Badge color={(ACTION_C[r.action] ?? "slate") as never}>{r.action}</Badge></td>
                <td className="num muted" style={{ fontSize: 13 }}>{r.entity}</td>
                <td className="muted">{r.summary}</td>
                <td>
                  <div className="actions">
                    <button className="act-btn" title="View diff" onClick={() => setSel(r)}><Eye size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && <AuditModal row={sel} onClose={() => setSel(null)} />}
    </>
  );
}
