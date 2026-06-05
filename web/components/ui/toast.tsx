"use client";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAppStore } from "@/store/app";

export function ToastHost() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <div
            className="toast-ic"
            style={{
              background: t.kind === "error" ? "var(--tint-rose)"    : "var(--tint-emerald)",
              color:      t.kind === "error" ? "var(--status-rose)"   : "var(--status-emerald)",
            }}
          >
            {t.kind === "error" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          </div>
          <div>
            <div className="toast-title">{t.title}</div>
            {t.sub && <div className="toast-sub">{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
