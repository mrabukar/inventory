"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { useAppStore } from "@/store/app";

function formatToastTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ToastHost() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => {
        const isError = t.kind === "error";
        const heading = isError ? "Error" : "Success";
        return (
          <div
            className={isError ? "toast toast--error" : "toast toast--success"}
            key={t.id}
          >
            <div className="toast-ic">
              {isError ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
            </div>
            <div className="toast-body">
              <div className="toast-head">
                <span className="toast-heading">{heading}</span>
                <time
                  className="toast-time"
                  dateTime={t.createdAt}
                >
                  {formatToastTimestamp(t.createdAt)}
                </time>
              </div>
              <div className="toast-message">{t.title}</div>
              {t.sub ? (
                <div
                  className={
                    isError
                      ? "toast-sub toast-sub--error"
                      : "toast-sub toast-sub--success"
                  }
                >
                  {t.sub}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
