"use client";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAppStore } from "@/store/app";

export function ToastHost() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => {
        const isError = t.kind === "error";
        return (
          <div
            className={isError ? "toast toast--error" : "toast"}
            key={t.id}
          >
            <div
              className="toast-ic"
              style={
                isError
                  ? undefined
                  : {
                      background: "var(--tint-emerald)",
                      color: "var(--status-emerald)",
                    }
              }
            >
              {isError ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
            </div>
            <div>
              <div className="toast-title">{t.title}</div>
              {t.sub && (
                <div className={isError ? "toast-sub toast-sub--error" : "toast-sub"}>
                  {t.sub}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
