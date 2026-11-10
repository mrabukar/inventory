"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toNumber } from "@/lib/reports/format";
import { cn, fmt } from "@/lib/utils";
import { saleUnitsSold, type Sale } from "@/types/sales/sale";

const inputClassName =
  "flex w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface RejectSaleDialogProps {
  sale: Sale;
  isSaving: boolean;
  onReject: (reason: string) => void;
  onClose: () => void;
}

export function RejectSaleDialog({
  sale,
  isSaving,
  onReject,
  onClose,
}: RejectSaleDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const units = saleUnitsSold(sale);
  const collected = toNumber(sale.paidAtSubmission ?? 0);

  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(`Tell ${sale.soldBy.name} why, so they can fix it`);
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
              Reject this sale?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {units} unit{units === 1 ? "" : "s"} go back into{" "}
              {sale.store.name}&apos;s stock. {sale.soldBy.name} sees your
              reason in their sales history.
            </Dialog.Description>
          </div>

          {collected > 0 ? (
            <div
              role="alert"
              className="flex gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {fmt(collected)} was collected at the counter. Refund it
                outside the app. Rejecting doesn&apos;t record a refund.
              </span>
            </div>
          ) : null}

          <div className="grid gap-2">
            <label
              htmlFor="reject-reason"
              className="text-sm font-medium leading-none"
            >
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="reject-reason"
              className={cn(
                inputClassName,
                "min-h-[88px] resize-y py-2",
                error && "border-destructive",
              )}
              value={reason}
              maxLength={500}
              autoFocus
              disabled={isSaving}
              placeholder="e.g. Wrong product. Customer bought the 128GB model."
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submit}
              disabled={isSaving}
            >
              {isSaving ? "Rejecting…" : "Reject sale"}
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
