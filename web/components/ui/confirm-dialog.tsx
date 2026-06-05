"use client";
import { useEffect } from "react";
import { Button } from "./button";

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  variant = "danger",
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="dialog">
      <div className="overlay" onClick={onClose} />
      <div className="dialog-box">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="dialog-row">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
