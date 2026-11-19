"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BranchPayment } from "@/types/credit-branches/credit-branch";

const inputClassName =
  "flex w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface Props {
  payment: BranchPayment;
  isSaving: boolean;
  onReject: (reason: string) => void;
  onClose: () => void;
}

export function RejectBranchPaymentDialog({
  payment,
  isSaving,
  onReject,
  onClose,
}: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Tell them why, so they can resubmit it correctly");
      return;
    }
    onReject(trimmed);
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg sm:rounded-lg">
          <div className="grid gap-1.5 pr-6">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Reject this payment?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {payment.store.name} will see your reason and can submit it
              again. Their balance stays as it is.
            </Dialog.Description>
          </div>

          <div className="grid gap-2">
            <label htmlFor="reject-payment-reason" className="text-sm font-medium leading-none">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="reject-payment-reason"
              className={cn(inputClassName, "min-h-[88px] resize-y py-2", error && "border-destructive")}
              value={reason}
              maxLength={500}
              autoFocus
              disabled={isSaving}
              placeholder="e.g. We can't find this EVC reference."
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={submit} disabled={isSaving}>
              {isSaving ? "Rejecting…" : "Reject payment"}
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
