"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatProductLabel } from "@/lib/products/format";
import type { Inventory } from "@/types/inventory/inventory";
import type { WarehouseStockWriteOffInput } from "@/service/inventory/write-off-warehouse-stock";

interface WarehouseWriteOffModalProps {
  open: boolean;
  row: Inventory | null;
  onClose: () => void;
  onSave: (data: WarehouseStockWriteOffInput) => void;
  isSaving: boolean;
}

function FormField({
  label,
  required,
  error,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium leading-none">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {helper && !error ? (
        <p className="text-sm text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

const inputClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function WarehouseWriteOffModal({
  open,
  row,
  onClose,
  onSave,
  isSaving,
}: WarehouseWriteOffModalProps) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<{ quantity?: string; note?: string }>({});

  useEffect(() => {
    if (!open || !row) return;
    setQuantity(String(row.quantity));
    setNote("");
    setErr({});
  }, [open, row]);

  const save = () => {
    if (!row) return;

    const next: typeof err = {};
    const qty = Number(quantity);

    if (!quantity || qty <= 0) next.quantity = "Enter how many units to remove";
    if (qty > row.quantity) {
      next.quantity = `Cannot remove more than ${row.quantity} units in warehouse`;
    }
    if (!note.trim()) next.note = "Please explain why stock is being removed";

    setErr(next);
    if (Object.keys(next).length) return;

    onSave({
      productId: row.productId,
      quantity: qty,
      note: note.trim(),
    });
  };

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
              Remove warehouse stock
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Reduce central stock without distributing to stores. Use this to
              clear mistaken purchases before deactivating a product.
            </Dialog.Description>
          </div>

          {row ? (
            <div className="grid gap-4 py-2">
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-medium">Product: </span>
                <span>
                  {formatProductLabel(row.product.name, row.product.model)}
                </span>
                <div className="mt-1 text-muted-foreground">
                  {row.quantity} unit{row.quantity === 1 ? "" : "s"} in warehouse
                </div>
              </div>

              <FormField
                label="Units to remove"
                required
                error={err.quantity}
                helper="Enter a positive number. Use the full quantity to clear warehouse stock."
              >
                <div className="flex gap-2">
                  <input
                    className={cn(
                      inputClassName,
                      err.quantity && "border-destructive",
                    )}
                    type="number"
                    min={1}
                    max={row.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 300"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQuantity(String(row.quantity))}
                  >
                    All ({row.quantity})
                  </Button>
                </div>
              </FormField>

              <FormField
                label="Reason"
                required
                error={err.note}
              >
                <textarea
                  className={cn(
                    inputClassName,
                    "min-h-[80px] resize-y py-2",
                    err.note && "border-destructive",
                  )}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Wrong product created — clearing stock before deactivation"
                />
              </FormField>
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
            <Button type="button" onClick={save} disabled={isSaving || !row}>
              {isSaving ? "Saving…" : "Remove stock"}
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
