"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "./button";

interface Props {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLoading, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="dialog" style={{ zIndex: 200 }} role="presentation">
      <div
        className="overlay"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />
      <div
        className="dialog-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
        <div className="dialog-row">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Loading…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
