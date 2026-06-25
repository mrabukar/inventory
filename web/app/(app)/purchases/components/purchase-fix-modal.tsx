"use client";

import { useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInventory } from "@/hooks/inventory/use-inventory";
import { cn, fmt } from "@/lib/utils";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import {
  computeWeightedAverageCost,
  reverseWeightedAverageCost,
} from "@/lib/purchases/weighted-average";
import { purchaseReversibleQuantity } from "@/lib/purchases/reversible-quantity";
import type {
  CorrectPurchaseInput,
  Purchase,
} from "@/types/purchases/purchase";
import type { PurchaseFixMode } from "./purchase-fix-chooser-modal";

interface PurchaseFixModalProps {
  open: boolean;
  mode: PurchaseFixMode;
  purchase: Purchase | null;
  onClose: () => void;
  onSave: (data: CorrectPurchaseInput) => void;
  isSaving: boolean;
}

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const COPY = {
  add: {
    title: "Add missing units",
    description:
      "Record units that were bought but not counted on the original purchase.",
    quantityLabel: "How many units were missing?",
    quantityPlaceholder: "e.g. 2",
    helper:
      "Units are added to the warehouse and counted toward this purchase at the original unit cost.",
    submit: "Add missing units",
  },
  subtract: {
    title: "Remove extra units",
    description:
      "Remove units that were recorded by mistake and should not count toward this purchase.",
    quantityLabel: "How many extra units should be removed?",
    quantityPlaceholder: "e.g. 2",
    helper:
      "The units must still be in the warehouse (not yet distributed or sold).",
    submit: "Remove extra units",
  },
} as const;

export function PurchaseFixModal({
  open,
  mode,
  purchase,
  onClose,
  onSave,
  isSaving,
}: PurchaseFixModalProps) {
  const copy = COPY[mode];
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<{ quantity?: string; reason?: string }>({});

  const { data: inventoryData } = useInventory(
    { productId: purchase?.productId || undefined, limit: 100 },
    "all",
  );

  const onHand = useMemo(
    () =>
      (inventoryData?.data ?? []).reduce((sum, row) => sum + row.quantity, 0),
    [inventoryData?.data],
  );

  const maxRemovable = purchase ? purchaseReversibleQuantity(purchase) : 0;

  const preview = useMemo(() => {
    if (!purchase || !quantity) return null;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return null;

    const currentAverage = toNumber(purchase.product.averageCost);
    const originalUnitCost = toNumber(purchase.unitPurchasePrice);

    if (mode === "add") {
      const newAverage = computeWeightedAverageCost(
        onHand,
        currentAverage,
        qty,
        originalUnitCost,
      );
      return {
        newAverage,
        valueChange: qty * originalUnitCost,
        netPurchased: maxRemovable + qty,
      };
    }

    if (qty > maxRemovable) return null;

    const newAverage = reverseWeightedAverageCost(
      onHand,
      currentAverage,
      qty,
      originalUnitCost,
    );
    return {
      newAverage,
      valueChange: qty * originalUnitCost,
      netPurchased: maxRemovable - qty,
    };
  }, [purchase, quantity, onHand, maxRemovable, mode]);

  const quantityError = (() => {
    if (!purchase || !quantity) return undefined;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return "Enter a positive number of units";
    }
    if (mode === "subtract") {
      if (qty > maxRemovable) {
        return `Cannot remove more than ${maxRemovable} unit${maxRemovable === 1 ? "" : "s"}`;
      }
      if (onHand > 0 && qty > onHand) {
        return `Only ${onHand} unit${onHand === 1 ? "" : "s"} are on hand in the warehouse`;
      }
    }
    return undefined;
  })();

  const save = () => {
    if (!purchase) return;

    const next: typeof err = {};
    const qty = Number(quantity);
    if (!quantity || !Number.isFinite(qty) || qty <= 0) {
      next.quantity = "Enter a positive number of units";
    } else if (mode === "subtract") {
      if (qty > maxRemovable) {
        next.quantity = `Cannot remove more than ${maxRemovable} unit${maxRemovable === 1 ? "" : "s"}`;
      } else if (onHand > 0 && qty > onHand) {
        next.quantity = `Only ${onHand} unit${onHand === 1 ? "" : "s"} are on hand in the warehouse`;
      }
    }
    if (!reason.trim()) {
      next.reason = "Please explain why this purchase is being corrected";
    }

    setErr(next);
    if (Object.keys(next).length) return;

    onSave({ quantity: qty, reason: reason.trim() });
  };

  const canSave =
    purchase != null &&
    quantity !== "" &&
    Number.isFinite(Number(quantity)) &&
    Number(quantity) > 0 &&
    (mode === "add" ||
      (Number(quantity) <= maxRemovable &&
        (onHand <= 0 || Number(quantity) <= onHand))) &&
    reason.trim().length > 0 &&
    !isSaving;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:max-h-[90vh] sm:overflow-y-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg",
          )}
        >
          <div className="flex flex-col gap-1.5 text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              {copy.title}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {copy.description}
            </Dialog.Description>
          </div>

          {purchase ? (
            <div className="grid gap-4 py-2">
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-medium">Product: </span>
                <span>
                  {formatProductLabel(
                    purchase.product.name,
                    purchase.product.model,
                  )}
                </span>
                <div className="mt-1 text-muted-foreground">
                  Originally recorded {purchase.quantity} unit
                  {purchase.quantity === 1 ? "" : "s"} @{" "}
                  {fmt(toNumber(purchase.unitPurchasePrice))}
                  {mode === "subtract" && maxRemovable < purchase.quantity ? (
                    <>
                      {" "}
                      · {maxRemovable} can still be removed
                    </>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium leading-none">
                  {copy.quantityLabel}
                  <span className="text-destructive"> *</span>
                </label>
                <div className="flex gap-2">
                  <input
                    className={cn(
                      inputClassName,
                      (err.quantity || quantityError) && "border-destructive",
                    )}
                    type="number"
                    min={1}
                    max={
                      mode === "subtract" && maxRemovable > 0
                        ? maxRemovable
                        : undefined
                    }
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      if (err.quantity) {
                        setErr((prev) => ({ ...prev, quantity: undefined }));
                      }
                    }}
                    placeholder={copy.quantityPlaceholder}
                  />
                  {mode === "subtract" && maxRemovable > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setQuantity(String(maxRemovable))}
                    >
                      All ({maxRemovable})
                    </Button>
                  ) : null}
                </div>
                {err.quantity || quantityError ? (
                  <p className="text-sm text-destructive">
                    {err.quantity ?? quantityError}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{copy.helper}</p>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium leading-none">
                  Reason
                  <span className="text-destructive"> *</span>
                </label>
                <textarea
                  className={cn(
                    inputClassName,
                    "min-h-[80px] resize-y py-2",
                    err.reason && "border-destructive",
                  )}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    mode === "add"
                      ? "e.g. Entered 18 by mistake — actually bought 20"
                      : "e.g. Entered 20 by mistake — only 18 were bought"
                  }
                />
                {err.reason ? (
                  <p className="text-sm text-destructive">{err.reason}</p>
                ) : null}
              </div>

              {preview ? (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p>
                    New average cost:{" "}
                    <strong>{preview.newAverage.toFixed(2)}</strong>
                  </p>
                  <p>
                    Net purchased on this row after fix →{" "}
                    <strong>{preview.netPurchased}</strong>;
                    stock investment{" "}
                    {mode === "add" ? "increased" : "reduced"} by{" "}
                    <strong>{fmt(preview.valueChange)}</strong>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

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
              variant={mode === "subtract" ? "destructive" : "default"}
              onClick={save}
              disabled={!canSave}
            >
              {isSaving ? "Saving…" : copy.submit}
            </Button>
          </div>

          <Dialog.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={onClose}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
