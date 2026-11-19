"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { todayYmd } from "@/lib/filters/dates";
import { cn, fmt } from "@/lib/utils";
import {
  BRANCH_PAYMENT_METHODS,
  branchPaymentMethodLabel,
  type BranchPaymentMethod,
  type SubmitBranchPaymentInput,
} from "@/types/credit-branches/credit-branch";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface Props {
  balance: number;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: SubmitBranchPaymentInput) => void;
}

export function SubmitPaymentModal({ balance, isSaving, onClose, onSave }: Props) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayYmd());
  const [method, setMethod] = useState<BranchPaymentMethod>("evc");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError("Enter the amount you paid");
      return;
    }
    if (parsed > balance + 0.001) {
      setError(`That's more than you owe (${fmt(balance)})`);
      return;
    }
    setError(null);
    onSave({
      amount: parsed,
      paidAt,
      method,
      reference: reference.trim() || undefined,
    });
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg sm:rounded-lg">
          <div className="grid gap-1.5 pr-6">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Submit a payment
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              You owe {fmt(balance)}. An admin reviews this before it comes
              off your balance.
            </Dialog.Description>
          </div>

          {error ? <div className="alert-error">{error}</div> : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">
              Amount <span className="text-destructive">*</span>
            </label>
            <input
              className={inputCls}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={fmt(balance)}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">Date paid</label>
            <input
              type="date"
              className={inputCls}
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">Method</label>
            <div className="flex flex-wrap gap-2">
              {BRANCH_PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    method === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {branchPaymentMethodLabel(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">Reference</label>
            <input
              className={inputCls}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction or receipt number"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving ? "Submitting…" : "Submit"}
            </Button>
          </div>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            disabled={isSaving}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
